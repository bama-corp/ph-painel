import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authorize,
  corsHeaders,
  deleteTask,
  ensureSchema,
  ensureTasksSchema,
  getSnapshot,
  getSql,
  getTasksSql,
  listTasks,
  putSnapshot,
  upsertTask,
  upsertTasksBatch,
} from "./db.mjs";
import {
  authorizeNotify,
  buildTasksDigest,
  notifyChannelsConfigured,
  sendNotify,
} from "./notify.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve(root, ".env"));

const PORT = Number(process.env.PH_API_PORT || 8787);

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

function send(res, status, body, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function tasksDbMissing(res, origin) {
  send(
    res,
    503,
    {
      error: "TASKS_DATABASE_URL em falta no .env. Usa um projecto Neon separado do financeiro.",
      missing: "TASKS_DATABASE_URL",
    },
    origin,
  );
}

async function handleState(req, res, origin) {
  const sql = getSql();
  await ensureSchema(sql);

  if (req.method === "GET") {
    const row = await getSnapshot(sql);
    if (!row) {
      send(res, 404, { error: "Sem snapshot na BD.", empty: true }, origin);
      return;
    }
    send(
      res,
      200,
      {
        id: row.id,
        schemaVersion: row.schema_version,
        updatedAt: row.updated_at,
        state: row.payload,
      },
      origin,
    );
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const state = body?.state ?? body;
    if (!state?.accounts || !state?.rules) {
      send(res, 400, { error: "Payload inválido: falta accounts/rules." }, origin);
      return;
    }
    const schemaVersion = Number(state.schemaVersion ?? body?.schemaVersion ?? 4);
    const saved = await putSnapshot(sql, state, schemaVersion);
    send(
      res,
      200,
      {
        ok: true,
        id: saved.id,
        schemaVersion: saved.schema_version,
        updatedAt: saved.updated_at,
      },
      origin,
    );
    return;
  }

  send(res, 405, { error: "Method not allowed" }, origin);
}

async function handleTasksCollection(req, res, origin) {
  if (!process.env.TASKS_DATABASE_URL) {
    tasksDbMissing(res, origin);
    return;
  }
  const sql = getTasksSql();
  await ensureTasksSchema(sql);

  if (req.method === "GET") {
    const tasks = await listTasks(sql);
    send(res, 200, { tasks }, origin);
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const tasks = body?.tasks;
    if (!Array.isArray(tasks)) {
      send(res, 400, { error: "Payload inválido: falta tasks[]." }, origin);
      return;
    }
    try {
      const saved = await upsertTasksBatch(sql, tasks);
      send(res, 200, { ok: true, tasks: saved }, origin);
    } catch (e) {
      send(res, 400, { error: e.message || "Tarefas inválidas." }, origin);
    }
    return;
  }

  send(res, 405, { error: "Method not allowed" }, origin);
}

async function handleTaskItem(req, res, origin, id) {
  if (!process.env.TASKS_DATABASE_URL) {
    tasksDbMissing(res, origin);
    return;
  }
  const sql = getTasksSql();
  await ensureTasksSchema(sql);

  if (req.method === "PUT") {
    const body = await readBody(req);
    const payload = { ...(body?.task ?? body ?? {}), id };
    try {
      const task = await upsertTask(sql, payload);
      send(res, 200, { ok: true, task }, origin);
    } catch (e) {
      send(res, 400, { error: e.message || "Tarefa inválida." }, origin);
    }
    return;
  }

  if (req.method === "DELETE") {
    const r = await deleteTask(sql, id);
    if (!r.deleted) {
      send(res, 404, { error: "Tarefa não encontrada.", id }, origin);
      return;
    }
    send(res, 200, { ok: true, id }, origin);
    return;
  }

  send(res, 405, { error: "Method not allowed" }, origin);
}

async function handleNotifyTasks(req, res, origin, url) {
  const auth = authorizeNotify(req);
  if (!auth.ok) {
    send(res, auth.status, { error: auth.error }, origin);
    return;
  }

  const channels = notifyChannelsConfigured();
  if (!channels.any) {
    send(
      res,
      503,
      {
        error:
          "Configura NTFY_TOPIC no .env (ou TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).",
        channels,
      },
      origin,
    );
    return;
  }

  const dry = url.searchParams.get("dry") === "1";
  const testOnly = url.searchParams.get("test") === "1";

  if (testOnly) {
    const text = `PH · teste ${new Date().toISOString().slice(0, 19)}Z\nSe leste isto no telemóvel, está ok.`;
    if (dry) {
      send(res, 200, { ok: true, dry: true, text, channels }, origin);
      return;
    }
    const sent = await sendNotify(text);
    if (!sent.ok) {
      send(res, 502, { error: sent.reason, channels }, origin);
      return;
    }
    send(res, 200, { ok: true, via: sent.via, channels }, origin);
    return;
  }

  if (!process.env.TASKS_DATABASE_URL) {
    tasksDbMissing(res, origin);
    return;
  }

  const sql = getTasksSql();
  await ensureTasksSchema(sql);
  const tasks = await listTasks(sql);
  const digest = buildTasksDigest(tasks);

  if (dry) {
    send(res, 200, { ok: true, dry: true, digest, channels }, origin);
    return;
  }

  const sent = await sendNotify(digest.text);
  if (!sent.ok) {
    send(res, 502, { error: sent.reason, digest, channels }, origin);
    return;
  }
  send(res, 200, { ok: true, via: sent.via, counts: digest.counts, channels }, origin);
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // Notify tem auth própria (secret/cron) — não passa pelo authorize global
  if (url.pathname === "/api/notify/tasks") {
    if (req.method !== "GET" && req.method !== "POST") {
      send(res, 405, { error: "Method not allowed" }, origin);
      return;
    }
    try {
      await handleNotifyTasks(req, res, origin, url);
    } catch (e) {
      console.error(e);
      send(res, 500, { error: e.message || "Erro interno" }, origin);
    }
    return;
  }

  const auth = authorize(req);
  if (!auth.ok) {
    send(res, auth.status, { error: auth.error }, origin);
    return;
  }

  try {
    if (url.pathname === "/api/state") {
      await handleState(req, res, origin);
      return;
    }
    if (url.pathname === "/api/tasks") {
      await handleTasksCollection(req, res, origin);
      return;
    }
    const one = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (one) {
      await handleTaskItem(req, res, origin, decodeURIComponent(one[1]));
      return;
    }
    send(res, 404, { error: "Not found" }, origin);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || "Erro interno" }, origin);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`PH API já a correr em http://localhost:${PORT} (porta ocupada).`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  const tasks = process.env.TASKS_DATABASE_URL ? "tasks OK" : "tasks SEM TASKS_DATABASE_URL";
  console.log(
    `PH API (Neon) em http://localhost:${PORT}/api/state · /api/tasks · /api/notify/tasks (${tasks})`,
  );
});
