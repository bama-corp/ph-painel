import {
  authConfigured,
  authProfile,
  createSessionToken,
  sessionCookieHeader,
  verifyCredentials,
} from "../../server/auth.mjs";
import { corsHeaders } from "../../server/db.mjs";

function getOrigin(req) {
  return req.headers?.origin || req.headers?.Origin;
}

function send(res, status, body, origin, extraHeaders = {}) {
  res.statusCode = status;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
    ...extraHeaders,
  };
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "set-cookie") res.setHeader("Set-Cookie", v);
    else res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
}

/** POST /api/auth/login — { login, password } */
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
    send(res, 405, { error: "Usa POST." }, origin);
    return;
  }

  if (!authConfigured()) {
    send(res, 503, { error: "Auth não configurada no servidor (AUTH_*)." }, origin);
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") body = {};

  const login = String(body.login ?? body.email ?? body.username ?? "").trim();
  const password = String(body.password ?? "");
  const result = verifyCredentials(login, password);
  if (!result.ok) {
    send(res, 401, { error: result.reason }, origin);
    return;
  }

  const token = createSessionToken(result.user);
  const profile = authProfile();
  send(
    res,
    200,
    { ok: true, user: { name: profile.name, email: profile.email } },
    origin,
    { "Set-Cookie": sessionCookieHeader(token) },
  );
}
