import { sessionCookieHeader } from "../../server/auth.mjs";
import { corsHeaders } from "../../server/db.mjs";

function getOrigin(req) {
  return req.headers?.origin || req.headers?.Origin;
}

/** POST /api/auth/logout */
export default async function handler(req, res) {
  const origin = getOrigin(req);
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    res.statusCode = 204;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Usa POST." }));
    return;
  }

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
    "Set-Cookie": sessionCookieHeader("", { clear: true }),
  };
  res.statusCode = 200;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "set-cookie") res.setHeader("Set-Cookie", v);
    else res.setHeader(k, v);
  }
  res.end(JSON.stringify({ ok: true }));
}
