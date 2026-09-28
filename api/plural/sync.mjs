import { authorize, corsHeaders } from "../../server/db.mjs";
import { pluralLinked, syncPluralIntoNeon } from "../../server/plural-bridge.mjs";

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

/**
 * GET|POST /api/plural/sync — puxa Plural e grava no Neon (cron / botão servidor).
 * Auth: mesma chave PH (authorize) ou Vercel Cron (Authorization: Bearer CRON_SECRET).
 */
export default async function handler(req, res) {
  const origin = getOrigin(req);
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    res.statusCode = 204;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" }, origin);
    return;
  }

  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const authHeader = req.headers?.authorization || "";
  const isCron =
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` ||
      req.headers?.["x-vercel-cron"] === "1");

  if (!isCron) {
    const auth = authorize(req);
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error }, origin);
      return;
    }
  }

  if (!pluralLinked()) {
    json(res, 503, { error: "PLURAL_API_URL / PLURAL_API_KEY em falta no servidor PH." }, origin);
    return;
  }

  try {
    const result = await syncPluralIntoNeon({ event: "cron" });
    if (!result.ok) {
      json(res, result.status || 502, { error: result.reason }, origin);
      return;
    }
    json(res, 200, result, origin);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
