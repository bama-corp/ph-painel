import { applyDeallocateAll, partyOf, postLiquidityAdjustment, snapEntityLiveTotal } from "./engine";
import {
  ACCOUNT_SNAPSHOT,
  OTHER_COMPANY_LIVE_SNAPSHOT,
  PDS_LIVE_SNAPSHOT,
  PERSONAL_LIVE_SNAPSHOT,
  seedState,
} from "./seed";
import type {
  AppState,
  BudgetBucket,
  BudgetLine,
  CostNature,
  IncomeSource,
  OwnershipClass,
  Party,
  RecurringCost,
} from "./types";
import { SCHEMA_VERSION } from "./types";
import { roundKz, todayIso, currentMonthIso } from "./money";
import { detectBudgetMethodId } from "./definicaoRules";

const BUDGET_BUCKETS = new Set<BudgetBucket>([
  "obrigacoes",
  "reserva",
  "investimento",
  "despesas",
  "lazer",
]);

const COST_NATURES = new Set<CostNature>(["fixo", "variavel", "investimento", "retirada"]);

export const STORAGE_KEY = "ph-painel-v3";
export const CORRUPT_BACKUP_KEY = "ph-painel-v3-last-corrupt";

const CUSTODY_IDS = new Set(["lenu", "eduardo-gta"]);

function inferOwnership(p: Party): OwnershipClass {
  if (p.ownership) return p.ownership;
  if (p.role === "owner_current" || p.id === "emanuel-cw") return "company";
  if (CUSTODY_IDS.has(p.id) || /terceiros/i.test(p.name)) return "custody";
  return "own";
}

/** Serializa estado para export / backup. Nunca apaga histórico. */
export function exportStateJson(state: AppState): string {
  const payload = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadStateJson(state: AppState, filename?: string) {
  const json = exportStateJson(state);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `ph-painel-${state.asOf ?? "export"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function backupCorrupt(raw: string) {
  try {
    localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    localStorage.setItem(`${STORAGE_KEY}-corrupt-${Date.now()}`, raw.slice(0, 500_000));
  } catch {
    /* quota — best effort */
  }
}

/**
 * Migration:
 * - adiciona campos novos (schemaVersion, ownership, role, notes)
 * - preserva dados e movimentos existentes
 * - acrescenta contas/parties em falta a partir do seed
 * - nunca apaga histórico silenciosamente
 */
export function migrate(state: AppState): AppState {
  const fromVersion = typeof state.schemaVersion === "number" ? state.schemaVersion : 0;
  const seed = seedState();
  const rename: Record<string, string> = {
    "Caixa CW": "Caixa PDS",
    "Caixa Rove+": "Caixa Plural",
    "ATLANTICO — teu": "ATLANTICO",
    Cofre: "Carteira",
    BAI: "BAI 1",
    STAND: "STANDARD",
    "BAI 2": "Conta BAI",
    "CW — conta corrente do proprietário": "PDS — conta corrente do proprietário",
    "Equipamentos CW (PS, PCs, impressoras)": "Equipamentos PDS (PS, PCs, impressoras)",
  };

  let accounts = state.accounts.map((a) => ({ ...a, name: rename[a.name] ?? a.name }));
  let parties = state.parties.map((p) => {
    const name = rename[p.name] ?? p.name;
    const ownership = inferOwnership({ ...p, name });
    const role =
      p.role ??
      (p.id === "emanuel-cw" || ownership === "company" ? ("owner_current" as const) : undefined);
    return {
      ...p,
      name,
      ownership,
      role: p.id === "emanuel-cw" ? ("owner_current" as const) : role,
    };
  });

  // v9 — BAI 2 PDS: 10.711,38 + conta corrente 89.200.
  if (fromVersion < 9) {
    accounts = accounts.map((a) =>
      a.id === "cw-bai2" ? { ...a, opening: 10711.38 } : a,
    );
    parties = parties.map((p) =>
      p.id === "emanuel-cw" ? { ...p, opening: 89200, side: "receber" as const } : p,
    );
  }
  // v10 — Caixa PDS = 29.060 (snapshot).
  if (fromVersion < 10) {
    accounts = accounts.map((a) => (a.id === "cw-caixa" ? { ...a, opening: 29060 } : a));
  }
  // v11 — BAI 2 sem fatia pessoal («BAI 2 — teu» era incorrecto).
  if (fromVersion < 11) {
    accounts = accounts.filter((a) => a.id !== "bai2-p");
  }
  // v12 — custódia ligada à conta onde está; ATLANTICO deixa de se chamar «teu».
  if (fromVersion < 12) {
    accounts = accounts.map((a) =>
      a.id === "atlantico" || a.name === "ATLANTICO — teu" ? { ...a, name: "ATLANTICO" } : a,
    );
    parties = parties.map((p) => {
      if (p.ownership !== "custody" || p.heldInAccountId) return p;
      if (p.id === "lenu" || p.id === "eduardo-gta") {
        return { ...p, heldInAccountId: "atlantico" };
      }
      return p;
    });
  }

  const dropNunoDaniela =
    fromVersion < 23
      ? [
          "nuno",
          "daniela",
          ...parties
            .filter((p) => /^nuno$/i.test(p.name.trim()) || /^daniela$/i.test(p.name.trim()))
            .map((p) => p.id),
        ]
      : [];
  const dropPdsCustody =
    fromVersion < 24
      ? parties
          .filter(
            (p) =>
              p.ownership === "custody" &&
              /^pds(?:\s|$)/i.test(p.name.trim()),
          )
          .map((p) => p.id)
      : [];
  const dropTuniCustody =
    fromVersion < 25
      ? parties
          .filter(
            (p) =>
              p.ownership === "custody" &&
              /^tuni(?:\s|$)/i.test(p.name.trim()),
          )
          .map((p) => p.id)
      : [];
  const removedPartyIds = [
    ...new Set([
      ...(state.removedPartyIds ?? []),
      ...(fromVersion < 13 ? ["meneza"] : []),
      ...dropNunoDaniela,
      ...dropPdsCustody,
      ...dropTuniCustody,
    ]),
  ];

  // v13 — Meneza (pago, 0) sai; remoções de parties passam a ser respeitadas.
  if (fromVersion < 13) {
    parties = parties.filter((p) => p.id !== "meneza" && !removedPartyIds.includes(p.id));
  } else {
    parties = parties.filter((p) => !removedPartyIds.includes(p.id));
  }

  // v14 — conta corrente PDS (89.200) a zero: já não conta como saldo a receber.
  if (fromVersion < 14) {
    parties = parties.map((p) => (p.id === "emanuel-cw" ? { ...p, opening: 0 } : p));
  }

  // v15 — snapshot contas 2 nov 2026 (estado das contas).
  if (fromVersion < 15) {
    accounts = accounts.map((a) =>
      ACCOUNT_SNAPSHOT[a.id] !== undefined ? { ...a, opening: ACCOUNT_SNAPSHOT[a.id] } : a,
    );
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  const partyIds = new Set(parties.map((p) => p.id));
  const extraAccounts = seed.accounts.filter((a) => !accountIds.has(a.id));
  const extraParties = seed.parties.filter(
    (p) => !partyIds.has(p.id) && !removedPartyIds.includes(p.id),
  );

  const incomeSources = migrateIncomeSources(state, seed);
  const planned = roundKz(incomeSources.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0));
  const declared = { ...(state.declared ?? seed.declared), salary: planned };
  const rules = state.rules ?? seed.rules;
  const budgetMethodId =
    typeof state.budgetMethodId === "string" && state.budgetMethodId
      ? state.budgetMethodId
      : detectBudgetMethodId(rules);

  // Mês do painel: se ficou no passado (ex. seed agosto), sobe para o mês civil actual.
  const nowMonth = currentMonthIso();
  const month =
    typeof state.month === "string" && /^\d{4}-\d{2}$/.test(state.month) && state.month >= nowMonth
      ? state.month
      : nowMonth;

  let next: AppState = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    asOf: todayIso(),
    month,
    notes: state.notes ?? [],
    removedPartyIds,
    movements: state.movements ?? [],
    accounts: [...accounts, ...extraAccounts],
    parties: [...parties, ...extraParties],
    assets: (state.assets ?? []).map((a) => ({ ...a, name: rename[a.name] ?? a.name })),
    envelopes: state.envelopes?.length ? state.envelopes : seed.envelopes,
    rules,
    budgetMethodId,
    declared,
    recurring: migrateRecurring(state, seed),
    incomeSources,
    budgetLines: migrateBudgetLines(state),
    roveClients: state.roveClients ?? seed.roveClients,
  };

  // v16 — bolsos a zero para realocar com os saldos novos.
  if (fromVersion < 16) {
    const emptied = applyDeallocateAll(next, { at: next.asOf, idPrefix: "d-v16" });
    if (emptied.ok) next = emptied.state;
  }

  // v17 — saldo vivo = extracto (opening + movimentos antigos distorciam o Total).
  if (fromVersion < 17) {
    next = {
      ...next,
      accounts: next.accounts.map((a) =>
        ACCOUNT_SNAPSHOT[a.id] !== undefined ? { ...a, opening: ACCOUNT_SNAPSHOT[a.id] } : a,
      ),
    };
    for (const [id, target] of Object.entries(ACCOUNT_SNAPSHOT)) {
      if (!next.accounts.some((a) => a.id === id)) continue;
      const r = postLiquidityAdjustment(next, id, target, {
        at: next.asOf,
        id: `ajuste-v17-${id}`,
        note: "Snapshot 2 nov 2026 — saldo vivo = extracto",
      });
      if (r.ok) next = r.state;
    }
  }

  // v18 — Total pessoal = extracto. Não toca parties/custódia; opening fica.
  if (fromVersion < 18) {
    for (const [id, target] of Object.entries(PERSONAL_LIVE_SNAPSHOT)) {
      if (!next.accounts.some((a) => a.id === id)) continue;
      const r = postLiquidityAdjustment(next, id, target, {
        at: next.asOf,
        id: `ajuste-v18-${id}`,
        note: "Extracto pessoal — só o Total da conta",
      });
      if (r.ok) next = r.state;
    }
  }

  // v19 — Total PDS = extracto (Caixa + Conta BAI).
  if (fromVersion < 19) {
    for (const [id, target] of Object.entries(PDS_LIVE_SNAPSHOT)) {
      if (!next.accounts.some((a) => a.id === id)) continue;
      const r = postLiquidityAdjustment(next, id, target, {
        at: next.asOf,
        id: `ajuste-v19-${id}`,
        note: "Extracto PDS — só o Total da conta",
      });
      if (r.ok) next = r.state;
    }
  }

  // v20 — Total Plural, Picasso's e PH = extracto.
  if (fromVersion < 20) {
    for (const [id, target] of Object.entries(OTHER_COMPANY_LIVE_SNAPSHOT)) {
      if (!next.accounts.some((a) => a.id === id)) continue;
      const r = postLiquidityAdjustment(next, id, target, {
        at: next.asOf,
        id: `ajuste-v20-${id}`,
        note: "Extracto empresas — só o Total da conta",
      });
      if (r.ok) next = r.state;
    }
  }

  // v21 — Caixa actual Plural / Picasso's / PH (resolve a conta certa; reaplica se o v20 não gravou).
  if (fromVersion < 21) {
    const jobs = [
      ["rove", "rove-caixa", OTHER_COMPANY_LIVE_SNAPSHOT["rove-caixa"]],
      ["picasso", "picasso-caixa", OTHER_COMPANY_LIVE_SNAPSHOT["picasso-caixa"]],
      ["ph", "ph-caixa", OTHER_COMPANY_LIVE_SNAPSHOT["ph-caixa"]],
    ] as const;
    for (const [entity, id, target] of jobs) {
      const r = snapEntityLiveTotal(next, entity, id, target, {
        at: next.asOf,
        id: `ajuste-v21-${id}`,
        note: "Extracto empresas — Caixa actual",
      });
      if (r.ok) next = r.state;
    }
  }

  // v22 — dívida Lenu = 232.500 (saldo vivo). Não mexe na classificação nem nas contas.
  if (fromVersion < 22) {
    const LENU = 232_500;
    const party = next.parties.find(
      (p) => p.id === "lenu" || /\blenu\b/i.test(p.name),
    );
    if (party) {
      const live = partyOf(next, party.id);
      const opening = roundKz(party.opening + (LENU - live));
      next = {
        ...next,
        parties: next.parties.map((p) => (p.id === party.id ? { ...p, opening } : p)),
      };
    }
  }

  return next;
}

function migrateRecurring(state: AppState, seed: AppState): RecurringCost[] {
  const raw = Array.isArray(state.recurring) ? state.recurring : [];
  const mapped: RecurringCost[] = raw
    .filter((r) => r && r.entityId && r.name)
    .map((r) => ({
      id: String(r.id || `rc-${Math.random().toString(36).slice(2, 8)}`),
      entityId: r.entityId,
      name: String(r.name).trim() || "Custo",
      amount: roundKz(Number(r.amount) || 0),
      nature: (COST_NATURES.has(r.nature as CostNature) ? r.nature : "fixo") as CostNature,
      product: r.product,
      active: r.active !== false,
    }));
  const ids = new Set(mapped.map((r) => r.id));
  // Acrescenta recorrentes do seed em falta (ex. Plural após upgrade).
  for (const s of seed.recurring) {
    if (!ids.has(s.id)) mapped.push({ ...s, active: s.active !== false });
  }
  return mapped;
}

function migrateBudgetLines(state: AppState): BudgetLine[] {
  if (!Array.isArray(state.budgetLines)) return [];
  return state.budgetLines
    .filter((l) => l && BUDGET_BUCKETS.has(l.bucket as BudgetBucket))
    .map((l) => ({
      id: String(l.id || `bl-${Math.random().toString(36).slice(2, 8)}`),
      bucket: l.bucket as BudgetBucket,
      name: String(l.name || "Linha").trim() || "Linha",
      amount: roundKz(Number(l.amount) || 0),
      active: l.active !== false,
    }));
}

function migrateIncomeSources(state: AppState, seed: AppState): IncomeSource[] {
  if (Array.isArray(state.incomeSources) && state.incomeSources.length > 0) {
    return state.incomeSources.map((s) => ({
      id: s.id,
      name: String(s.name || "Fonte").trim() || "Fonte",
      amount: roundKz(Number(s.amount) || 0),
      active: s.active !== false,
    }));
  }
  const salary = roundKz(state.declared?.salary ?? seed.declared.salary);
  return [{ id: "gsa", name: "Salário GSA", amount: salary, active: true }];
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    let parsed: AppState;
    try {
      parsed = JSON.parse(raw) as AppState;
    } catch {
      backupCorrupt(raw);
      return seedState();
    }
    if (!parsed.accounts || !parsed.rules) {
      backupCorrupt(raw);
      return seedState();
    }
    return migrate(parsed);
  } catch {
    return seedState();
  }
}

/** Último backup de corrupção, se existir — para recuperação manual. */
export function readCorruptBackup(): string | null {
  try {
    return localStorage.getItem(CORRUPT_BACKUP_KEY);
  } catch {
    return null;
  }
}

export type ImportResult =
  | { ok: true; state: AppState }
  | { ok: false; reason: string };

/** Importa JSON (export da Vercel / backup) e aplica migrate. */
export function importStateJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "JSON inválido." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "Ficheiro não é um objecto de estado." };
  }
  const s = parsed as Partial<AppState>;
  if (!Array.isArray(s.accounts) || !s.rules) {
    return { ok: false, reason: "Falta accounts ou rules — não parece um export do PH." };
  }
  return { ok: true, state: migrate(s as AppState) };
}
