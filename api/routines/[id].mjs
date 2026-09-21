import {
  authorize,
  corsHeaders,
  deleteRoutine,
  ensureTasksSchema,
  getTasksSql,
  upsertRoutine,
} from "../../server/db.mjs";

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

function routineId(req) {
  const q = req.query?.id;
  if (typeof q === "string") return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  const url = req.url || "";
  const m = url.match(/\/api\/routines\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
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

  const id = routineId(req);
  if (!id) {
    json(res, 400, { error: "id obrigatório." }, origin);
    return;
  }

  try {
    const sql = getTasksSql();
    await ensureTasksSchema(sql);

    if (req.method === "PUT") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const payload = { ...(body?.routine ?? body ?? {}), id };
      try {
        const routine = await upsertRoutine(sql, payload);
        json(res, 200, { ok: true, routine }, origin);
      } catch (e) {
        json(res, 400, { error: e.message || "Rotina inválida." }, origin);
      }
      return;
    }

    if (req.method === "DELETE") {
      const r = await deleteRoutine(sql, id);
      if (!r.deleted) {
        json(res, 404, { error: "Rotina não encontrada.", id }, origin);
        return;
      }
      json(res, 200, { ok: true, id }, origin);
      return;
    }

    json(res, 405, { error: "Method not allowed" }, origin);
  } catch (e) {
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
