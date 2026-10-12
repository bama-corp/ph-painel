import {
  authConfigured,
  authProfile,
  createSessionToken,
  readSession,
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

function actionOf(req) {
  const q = req.query?.action;
  if (typeof q === "string") return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  const url = req.url || "";
  const m = url.match(/\/api\/auth\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** /api/auth/login | /api/auth/logout | /api/auth/me */
export default async function handler(req, res) {
  const origin = getOrigin(req);
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    res.statusCode = 204;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end();
    return;
  }

  const action = actionOf(req);

  if (action === "login") {
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
    return;
  }

  if (action === "logout") {
    if (req.method !== "POST") {
      send(res, 405, { error: "Usa POST." }, origin);
      return;
    }
    send(res, 200, { ok: true }, origin, {
      "Set-Cookie": sessionCookieHeader("", { clear: true }),
    });
    return;
  }

  if (action === "me") {
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
    return;
  }

  send(res, 404, { error: "Rota auth desconhecida." }, origin);
}
