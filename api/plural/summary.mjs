import { authorize, corsHeaders } from "../../server/db.mjs";
import { fetchFromPlural, pluralLinked } from "../../server/plural-bridge.mjs";

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

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" }, origin);
    return;
  }

  if (!pluralLinked()) {
    json(res, 503, { error: "PLURAL_API_URL / PLURAL_API_KEY em falta no servidor PH." }, origin);
    return;
  }

  const r = await fetchFromPlural("/api/ph/summary");
  if (!r.ok) {
    json(res, r.status, { error: r.error }, origin);
    return;
  }
  json(res, 200, r.body, origin);
}
