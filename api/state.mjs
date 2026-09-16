import { authorize, corsHeaders, ensureSchema, getSnapshot, getSql, putSnapshot } from "../server/db.mjs";

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

  try {
    const sql = getSql();
    await ensureSchema(sql);

    if (req.method === "GET") {
      const row = await getSnapshot(sql);
      if (!row) {
        json(res, 404, { error: "Sem snapshot na BD.", empty: true }, origin);
        return;
      }
      json(
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
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const state = body?.state ?? body;
      if (!state?.accounts || !state?.rules) {
        json(res, 400, { error: "Payload inválido: falta accounts/rules." }, origin);
        return;
      }
      const schemaVersion = Number(state.schemaVersion ?? body?.schemaVersion ?? 4);
      const saved = await putSnapshot(sql, state, schemaVersion);
      json(
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

    json(res, 405, { error: "Method not allowed" }, origin);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
