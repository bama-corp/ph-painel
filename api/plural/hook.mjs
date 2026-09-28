import { corsHeaders } from "../../server/db.mjs";
import {
  authorizePluralHook,
  syncPluralIntoNeon,
} from "../../server/plural-bridge.mjs";

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
 * POST /api/plural/hook — Plural → PH (webhook).
 * Bearer = PLURAL_HOOK_SECRET | PLURAL_API_KEY | PH_API_KEY
 * Body: { event, clientId, clientName?, amount?, at? }
 * Events payment/marcar-pago/renovar/ativar → sync + receita na caixa Plural.
 * Outros (suspender, sync) → só sync de clientes/custos.
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

  const auth = authorizePluralHook(req);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error }, origin);
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

    const result = await syncPluralIntoNeon({
      event: body.event || "sync",
      clientId: body.clientId,
      clientName: body.clientName,
      amount: body.amount,
      at: body.at,
    });

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
