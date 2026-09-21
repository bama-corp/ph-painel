import {
  authorize,
  corsHeaders,
  ensureTasksSchema,
  getTasksSql,
  listRoutines,
  upsertRoutinesBatch,
} from "../server/db.mjs";

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

  const auth = authorize(req);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error }, origin);
    return;
  }

  if (!process.env.TASKS_DATABASE_URL) {
    json(
      res,
      503,
      {
        error: "TASKS_DATABASE_URL em falta. Projecto Neon separado do financeiro.",
        missing: "TASKS_DATABASE_URL",
      },
      origin,
    );
    return;
  }

  try {
    const sql = getTasksSql();
    await ensureTasksSchema(sql);

    if (req.method === "GET") {
      const routines = await listRoutines(sql);
      json(res, 200, { routines }, origin);
      return;
    }

    if (req.method === "PUT") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const routines = body?.routines;
      if (!Array.isArray(routines)) {
        json(res, 400, { error: "Payload inválido: falta routines[]." }, origin);
        return;
      }
      try {
        const saved = await upsertRoutinesBatch(sql, routines);
        json(res, 200, { ok: true, routines: saved }, origin);
      } catch (e) {
        json(res, 400, { error: e.message || "Rotinas inválidas." }, origin);
      }
      return;
    }

    json(res, 405, { error: "Method not allowed" }, origin);
  } catch (e) {
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
