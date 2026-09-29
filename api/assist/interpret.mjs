import { authorize, corsHeaders } from "../../server/db.mjs";
import {
  assistLlmConfigured,
  buildAssistCatalog,
  interpretWithLlm,
} from "../../server/assist-llm.mjs";

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
 * POST /api/assist/interpret — LLM interpreta; motor local aplica depois.
 * GET  /api/assist/interpret — { configured }
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

  const auth = authorize(req);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error }, origin);
    return;
  }

  if (req.method === "GET") {
    json(res, 200, { configured: assistLlmConfigured() }, origin);
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" }, origin);
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body || typeof body !== "object") body = {};

    const text = String(body.text || "").trim();
    if (!text) {
      json(res, 400, { error: "text obrigatório" }, origin);
      return;
    }

    const catalog =
      typeof body.catalog === "string" && body.catalog
        ? body.catalog
        : buildAssistCatalog(body.state);

    const result = await interpretWithLlm({
      text,
      catalog,
      pendingSummary: body.pendingSummary || null,
    });

    if (!result.ok) {
      json(
        res,
        result.configured === false ? 503 : 502,
        { error: result.error, configured: result.configured !== false },
        origin,
      );
      return;
    }

    json(res, 200, { ok: true, intent: result.intent }, origin);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message || "Erro interno" }, origin);
  }
}
