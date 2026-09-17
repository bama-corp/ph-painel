import { seedState } from "./seed";
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
import { roundKz } from "./money";
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
  const seed = seedState();
  const rename: Record<string, string> = {
    "Caixa CW": "Caixa PDS",
    "Caixa Rove+": "Caixa Plural",
    ATLANTICO: "ATLANTICO — teu",
    "CW — conta corrente do proprietário": "PDS — conta corrente do proprietário",
    "Equipamentos CW (PS, PCs, impressoras)": "Equipamentos PDS (PS, PCs, impressoras)",
  };

  const accountIds = new Set(state.accounts.map((a) => a.id));
  const partyIds = new Set(state.parties.map((p) => p.id));
  const extraAccounts = seed.accounts.filter((a) => !accountIds.has(a.id));
  const extraParties = seed.parties.filter((p) => !partyIds.has(p.id));

  const incomeSources = migrateIncomeSources(state, seed);
  const planned = roundKz(incomeSources.filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0));
  const declared = { ...(state.declared ?? seed.declared), salary: planned };
  const rules = state.rules ?? seed.rules;
  const budgetMethodId =
    typeof state.budgetMethodId === "string" && state.budgetMethodId
      ? state.budgetMethodId
      : detectBudgetMethodId(rules);

  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    notes: state.notes ?? [],
    movements: state.movements ?? [],
    accounts: [
      ...state.accounts.map((a) => ({ ...a, name: rename[a.name] ?? a.name })),
      ...extraAccounts,
    ],
    parties: [
      ...state.parties.map((p) => {
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
      }),
      ...extraParties,
    ],
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
