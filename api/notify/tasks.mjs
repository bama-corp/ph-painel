import {
  corsHeaders,
  ensureTasksSchema,
  getTasksSql,
  listTasks,
} from "../server/db.mjs";
import {
  authorizeNotify,
  buildTasksDigest,
  notifyChannelsConfigured,
  sendNotify,
} from "../server/notify.mjs";

function getOrigin(req) {
  return req.headers?.origin || req.headers?.Origin;
}

function json(res, status, body, origin) {
  res.statusCode = status;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  };
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const origin = getOrigin(req);
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    res.statusCode = 204;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end();
    return;
  }

  const auth = authorizeNotify(req);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error }, origin);
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" }, origin);
    return;
  }

  const channels = notifyChannelsConfigured();
  if (!channels.any) {
    json(
      res,
      503,
      {
        error:
          "Configura NTFY_TOPIC (ou TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) no ambiente do servidor.",
        channels,
      },
      origin,
    );
    return;
  }

  if (!process.env.TASKS_DATABASE_URL) {
    json(
      res,
      503,
      { error: "TASKS_DATABASE_URL em falta.", missing: "TASKS_DATABASE_URL" },
      origin,
    );
    return;
  }

  try {
    let dry = false;
    let testOnly = false;
    try {
      const u = new URL(req.url || "/", "http://local");
      dry = u.searchParams.get("dry") === "1";
      testOnly = u.searchParams.get("test") === "1";
    } catch {
      /* ignore */
    }

    if (testOnly) {
      const text = `PH · teste ${new Date().toISOString().slice(0, 19)}Z\nSe leste isto no telemóvel, está ok.`;
      if (dry) {
        json(res, 200, { ok: true, dry: true, text, channels }, origin);
        return;
      }
      const sent = await sendNotify(text);
      if (!sent.ok) {
        json(res, 502, { error: sent.reason, channels }, origin);
        return;
      }
      json(res, 200, { ok: true, via: sent.via, channels }, origin);
      return;
    }

    const sql = getTasksSql();
    await ensureTasksSchema(sql);
    const tasks = await listTasks(sql);
    const digest = buildTasksDigest(tasks);

    if (dry) {
      json(res, 200, { ok: true, dry: true, digest, channels }, origin);
      return;
    }

    const sent = await sendNotify(digest.text);
    if (!sent.ok) {
      json(res, 502, { error: sent.reason, digest, channels }, origin);
      return;
    }
    json(res, 200, { ok: true, via: sent.via, counts: digest.counts, channels }, origin);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
