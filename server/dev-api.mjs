import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { authorize, corsHeaders, ensureSchema, getSnapshot, getSql, putSnapshot } from "./db.mjs";

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

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/api/state") {
    send(res, 404, { error: "Not found" }, origin);
    return;
  }

  const auth = authorize(req);
  if (!auth.ok) {
    send(res, auth.status, { error: auth.error }, origin);
    return;
  }

  try {
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
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || "Erro interno" }, origin);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`PH API já a correr em http://localhost:${PORT}/api/state (porta ocupada).`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`PH API (Neon) em http://localhost:${PORT}/api/state`);
});
