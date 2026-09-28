/**
 * Ponte PH ↔ Plural (servidor).
 * Env PH: PLURAL_API_URL + PLURAL_API_KEY (+ fallback VITE_*)
 * Webhook inbound: Bearer = PLURAL_API_KEY (ou PLURAL_HOOK_SECRET)
 */

import { ensureSchema, getSnapshot, getSql, putSnapshot } from "./db.mjs";

function pluralUpstream() {
  const url = (
    process.env.PLURAL_API_URL ||
    process.env.VITE_PLURAL_API_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const key = (process.env.PLURAL_API_KEY || process.env.VITE_PLURAL_API_KEY || "").trim();
  return { url, key };
}

export function pluralLinked() {
  const { url, key } = pluralUpstream();
  return Boolean(url && key);
}

/** Segredo aceite no webhook (Plural → PH). */
export function pluralHookSecret() {
  return (
    process.env.PLURAL_HOOK_SECRET ||
    process.env.PLURAL_API_KEY ||
    process.env.VITE_PLURAL_API_KEY ||
    process.env.PH_API_KEY ||
    ""
  ).trim();
}

export function authorizePluralHook(req) {
  const secret = pluralHookSecret();
  if (!secret) return { ok: false, status: 503, error: "Webhook Plural sem segredo no PH." };
  const auth = req.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) return { ok: false, status: 401, error: "Não autorizado" };
  return { ok: true };
}

/**
 * @param {string} path ex. /api/ph/summary
 */
export async function fetchFromPlural(path) {
  const { url, key } = pluralUpstream();
  if (!url || !key) {
    return {
      ok: false,
      status: 503,
      error: "PLURAL_API_URL / PLURAL_API_KEY em falta no servidor PH.",
    };
  }
  try {
    const res = await fetch(`${url}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: body.error || (res.status === 401 ? "Chave Plural inválida." : `HTTP ${res.status}`),
      };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : "Falha de rede ao contactar Plural",
    };
  }
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function mapStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "vencido" || s === "em_atraso") return "em_atraso";
  if (s === "cancelado") return "cancelado";
  if (s === "suspenso") return "suspenso";
  return "ativo";
}

function mapClient(c) {
  const rawId = String(c.id).replace(/^plural-/i, "");
  const dataFim = c.dataFim || null;
  const day = dataFim && dataFim.length >= 10 ? Number(dataFim.slice(8, 10)) : 1;
  return {
    id: `plural-${rawId}`,
    name: c.nome,
    product: String(c.servico).toLowerCase() === "iptv" ? "iptv" : "netflix",
    price: round2(c.valor),
    dueDay: Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1,
    status: mapStatus(c.status),
    lastPayment: null,
    nextPayment: dataFim,
  };
}

function upsertRecurring(state, id, name, amount, product) {
  const list = [...(state.recurring || [])];
  const idx = list.findIndex((r) => r.id === id);
  const row = {
    id,
    entityId: "rove",
    name,
    amount: round2(amount),
    nature: "fixo",
    product,
    active: true,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);
  return { ...state, recurring: list };
}

/** Aplica summary Plural ao AppState (clientes + declared + custos recorrentes). */
export function applyPluralSummaryMjs(state, summary) {
  const clients = (summary.clients || []).map(mapClient);
  const revenue = round2(
    typeof summary.mrrPainel === "number" ? summary.mrrPainel : summary.mrr,
  );
  let next = {
    ...state,
    roveClients: clients,
    declared: {
      ...state.declared,
      roveRevenue: revenue,
      roveProfit: round2(summary.lucroEstimado ?? state.declared?.roveProfit ?? 0),
    },
  };
  const custos = summary.custos || {};
  if (typeof custos.servidores === "number") {
    next = upsertRecurring(
      next,
      "plural-servidores",
      "Servidores IPTV (Plural)",
      custos.servidores,
      "iptv",
    );
  }
  if (typeof custos.salas === "number") {
    next = upsertRecurring(
      next,
      "plural-salas",
      "Salas Netflix (Plural)",
      custos.salas,
      "netflix",
    );
  }
  return next;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Receita na caixa Plural (ledger). Idempotente por note+amount+day se já existir. */
export function appendPluralPayment(state, opts) {
  const amount = round2(opts.amount);
  if (!(amount > 0)) return state;
  const at = opts.at || todayIso();
  const clientId = opts.clientId ? String(opts.clientId).replace(/^plural-/i, "") : "";
  const name = opts.clientName || "cliente";
  const note = `Plural · pago · ${name}${clientId ? ` (#${clientId})` : ""}`;
  const dup = (state.movements || []).some(
    (m) =>
      m.entityId === "rove" &&
      m.kind === "receita" &&
      m.note === note &&
      m.at?.slice(0, 10) === at.slice(0, 10) &&
      Math.abs(m.amount - amount) < 0.01,
  );
  if (dup) return state;
  const movement = {
    id: `plural-pay-${clientId || "x"}-${at.replace(/-/g, "")}-${Date.now().toString(36)}`,
    at,
    kind: "receita",
    amount,
    from: { type: "world" },
    to: { type: "liquidity", id: "rove-caixa" },
    entityId: "rove",
    note,
  };
  return { ...state, movements: [movement, ...(state.movements || [])] };
}

/**
 * Puxa summary do Plural, aplica ao snapshot Neon.
 * @param {{ event?: string, clientId?: string|number, clientName?: string, amount?: number, at?: string }} [hook]
 */
export async function syncPluralIntoNeon(hook = {}) {
  const pulled = await fetchFromPlural("/api/ph/summary");
  if (!pulled.ok) return { ok: false, reason: pulled.error, status: pulled.status };

  const sql = getSql();
  await ensureSchema(sql);
  const row = await getSnapshot(sql);
  const base = row?.payload;
  if (!base?.accounts) {
    return { ok: false, reason: "Sem snapshot financeiro no PH para aplicar sync.", status: 404 };
  }

  let state = applyPluralSummaryMjs(base, pulled.body);
  const ev = String(hook.event || "").toLowerCase();
  if (ev === "payment" || ev === "marcar-pago" || ev === "renovar" || ev === "ativar") {
    const amount =
      hook.amount != null
        ? Number(hook.amount)
        : (() => {
            const id = String(hook.clientId ?? "");
            const c = (pulled.body.clients || []).find((x) => String(x.id) === id);
            return c ? Number(c.valor) : 0;
          })();
    const name =
      hook.clientName ||
      (pulled.body.clients || []).find((x) => String(x.id) === String(hook.clientId ?? ""))?.nome;
    state = appendPluralPayment(state, {
      amount,
      clientId: hook.clientId,
      clientName: name,
      at: hook.at,
    });
  }

  const schemaVersion = Number(state.schemaVersion ?? row.schema_version ?? 4);
  const saved = await putSnapshot(sql, state, schemaVersion);
  return {
    ok: true,
    clients: state.roveClients?.length ?? 0,
    event: hook.event || "sync",
    updatedAt: saved.updated_at,
  };
}
