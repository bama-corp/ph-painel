import { authConfigured, authProfile, readSession } from "../../server/auth.mjs";
import { corsHeaders } from "../../server/db.mjs";

function getOrigin(req) {
  return req.headers?.origin || req.headers?.Origin;
}

function send(res, status, body, origin) {
  res.statusCode = status;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  };
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/** GET /api/auth/me */
export default async function handler(req, res) {
  const origin = getOrigin(req);
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    res.statusCode = 204;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    send(res, 405, { error: "Usa GET." }, origin);
    return;
  }

  if (!authConfigured()) {
    send(res, 200, { configured: false, authenticated: true, user: null }, origin);
    return;
  }

  const session = readSession(req);
  if (!session.ok) {
    send(res, 200, { configured: true, authenticated: false, user: null }, origin);
    return;
  }

  const profile = authProfile();
  send(
    res,
    200,
    {
      configured: true,
      authenticated: true,
      user: { name: profile.name, email: profile.email },
    },
    origin,
  );
}
