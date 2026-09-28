import type { AppState, RoveClient, RoveProduct, RoveStatus } from "./types";
import { roundKz } from "./money";

/** Base da API PH (vazio em local = proxy Vite → :8787). */
const PH_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const PH_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

export type PluralClientDto = {
  id: string;
  nome: string;
  servico: string;
  valor: number;
  dataFim: string | null;
  status: string;
};

export type PluralSummary = {
  asOf: string;
  mrr: number;
  /** Preferido: activos + vencidos + suspensos (alinhado ao PH). */
  mrrPainel?: number;
  lucroEstimado: number;
  byServico?: { netflix?: number; iptv?: number };
  counts?: { ativo?: number; vencido?: number; suspenso?: number; cancelado?: number };
  custos?: { servidores?: number; salas?: number; salaUnit?: number; salasAtivas?: number };
  clients: PluralClientDto[];
};

export type PluralFetch =
  | { ok: true; summary: PluralSummary }
  | { ok: false; reason: string; notConfigured?: boolean };

function phHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  if (PH_KEY) h.Authorization = `Bearer ${PH_KEY}`;
  return h;
}

/** Sync activo se a ponte no servidor PH estiver configurada (ou ainda não soubemos). */
let linkedKnown: boolean | null = null;

export function pluralConfigured() {
  if (linkedKnown === null) return true;
  return linkedKnown;
}

export function setPluralLinkedKnown(linked: boolean) {
  linkedKnown = linked;
}

export async function fetchPluralStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${PH_BASE}/api/plural/status`, { headers: phHeaders() });
    if (!res.ok) {
      linkedKnown = false;
      return false;
    }
    const data = (await res.json()) as { linked?: boolean };
    linkedKnown = Boolean(data.linked);
    return linkedKnown;
  } catch {
    linkedKnown = false;
    return false;
  }
}

function mapProduct(servico: string): RoveProduct {
  const s = servico.trim().toLowerCase();
  if (s === "iptv") return "iptv";
  return "netflix";
}

function mapStatus(status: string): RoveStatus {
  const s = status.trim().toLowerCase();
  if (s === "vencido" || s === "em_atraso") return "em_atraso";
  if (s === "cancelado") return "cancelado";
  if (s === "suspenso") return "suspenso";
  if (s === "potencial") return "potencial";
  if (s === "vence_em_breve") return "vence_em_breve";
  return "ativo";
}

function dueDayFrom(dataFim: string | null): number {
  if (!dataFim || dataFim.length < 10) return 1;
  const day = Number(dataFim.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
}

export function mapPluralClient(c: PluralClientDto): RoveClient {
  const rawId = String(c.id).replace(/^plural-/i, "");
  return {
    id: `plural-${rawId}`,
    name: c.nome,
    product: mapProduct(c.servico),
    price: roundKz(Number(c.valor) || 0),
    dueDay: dueDayFrom(c.dataFim),
    status: mapStatus(c.status),
    lastPayment: null,
    nextPayment: c.dataFim,
  };
}

export function mapPluralClients(summary: PluralSummary): RoveClient[] {
  return (summary.clients ?? []).map(mapPluralClient);
}

/** Substitui clientes Plural e alinha declared + recorrentes de custos Plural. */
export function applyPluralSummary(state: AppState, summary: PluralSummary): AppState {
  const revenue = roundKz(
    typeof summary.mrrPainel === "number" ? summary.mrrPainel : summary.mrr,
  );
  let next: AppState = {
    ...state,
    roveClients: mapPluralClients(summary),
    declared: {
      ...state.declared,
      roveRevenue: revenue,
      roveProfit: roundKz(summary.lucroEstimado),
    },
  };
  const custos = summary.custos;
  if (custos && typeof custos.servidores === "number") {
    next = upsertRecurringCost(next, {
      id: "plural-servidores",
      name: "Servidores IPTV (Plural)",
      amount: custos.servidores,
      product: "iptv",
    });
  }
  if (custos && typeof custos.salas === "number") {
    next = upsertRecurringCost(next, {
      id: "plural-salas",
      name: "Salas Netflix (Plural)",
      amount: custos.salas,
      product: "netflix",
    });
  }
  return next;
}

function upsertRecurringCost(
  state: AppState,
  row: { id: string; name: string; amount: number; product: RoveProduct },
): AppState {
  const list = [...(state.recurring ?? [])];
  const idx = list.findIndex((r) => r.id === row.id);
  const next = {
    id: row.id,
    entityId: "rove" as const,
    name: row.name,
    amount: roundKz(row.amount),
    nature: "fixo" as const,
    product: row.product,
    active: true,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  return { ...state, recurring: list };
}

/** Busca summary via proxy do PH (chave Plural só no servidor). */
export async function fetchPluralSummary(): Promise<PluralFetch> {
  try {
    const res = await fetch(`${PH_BASE}/api/plural/summary`, { headers: phHeaders() });
    const body = (await res.json().catch(() => ({}))) as PluralSummary & { error?: string };
    if (res.status === 503) {
      linkedKnown = false;
      return {
        ok: false,
        notConfigured: true,
        reason: body.error || "Ponte Plural não configurada no servidor PH.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: body.error || (res.status === 401 ? "Não autorizado na API PH." : `HTTP ${res.status}`),
      };
    }
    if (!Array.isArray(body.clients) || typeof body.mrr !== "number") {
      return { ok: false, reason: "Resposta Plural sem clients/mrr." };
    }
    linkedKnown = true;
    return { ok: true, summary: body };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede (ponte Plural)" };
  }
}

/** Puxa Plural no servidor (grava Neon) — preferir ao apply só no browser. */
export async function requestPluralServerSync(): Promise<
  { ok: true } | { ok: false; reason: string; notConfigured?: boolean }
> {
  try {
    const res = await fetch(`${PH_BASE}/api/plural/sync`, {
      method: "POST",
      headers: phHeaders(),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 503) {
      linkedKnown = false;
      return {
        ok: false,
        notConfigured: true,
        reason: body.error || "Ponte Plural não configurada no servidor PH.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: body.error || `HTTP ${res.status}`,
      };
    }
    linkedKnown = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede (sync Plural)" };
  }
}

/** URL do painel Plural para abrir um cliente (`/clientes?id=`). */
export function pluralClientUrl(roveOrPluralId: string): string | null {
  const base = (import.meta.env.VITE_PLURAL_APP_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (!base) return null;
  const raw = String(roveOrPluralId).replace(/^plural-/i, "");
  if (!raw) return null;
  return `${base}/clientes?id=${encodeURIComponent(raw)}`;
}


