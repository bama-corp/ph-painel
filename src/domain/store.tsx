import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { seedState } from "./seed";
import type { AppState, BudgetRules, Movement, Party, RoveClient } from "./types";
import { uid } from "./money";

const KEY = "ph-painel-v3";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.accounts || !parsed.rules) return seedState();
    return migrateNames(parsed);
  } catch {
    return seedState();
  }
}

function migrateNames(state: AppState): AppState {
  const rename: Record<string, string> = {
    "Caixa CW": "Caixa PDS",
    "Caixa Rove+": "Caixa Plural",
    "ATLANTICO": "ATLANTICO — teu",
    "CW — conta corrente do proprietário": "PDS — conta corrente do proprietário",
    "Equipamentos CW (PS, PCs, impressoras)": "Equipamentos PDS (PS, PCs, impressoras)",
  };
  return {
    ...state,
    accounts: state.accounts.map((a) => ({ ...a, name: rename[a.name] ?? a.name })),
    parties: state.parties.map((p) => ({ ...p, name: rename[p.name] ?? p.name })),
    assets: state.assets.map((a) => ({ ...a, name: rename[a.name] ?? a.name })),
  };
}

type Store = {
  state: AppState;
  addMovement: (m: Omit<Movement, "id">) => void;
  setRules: (r: BudgetRules) => void;
  setParty: (id: string, patch: Partial<Party>) => void;
  setAccountOpening: (id: string, opening: number) => void;
  setClient: (id: string, patch: Partial<RoveClient>) => void;
  addClient: (c: Omit<RoveClient, "id">) => void;
  allocate: (parts: { envelopeId: string; amount: number }[]) => void;
  reset: () => void;
  setMonth: (month: string) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const store: Store = {
    state,
    addMovement: (m) =>
      setState((s) => ({ ...s, movements: [{ ...m, id: uid("m") }, ...s.movements] })),
    setRules: (rules) => setState((s) => ({ ...s, rules })),
    setParty: (id, patch) =>
      setState((s) => ({
        ...s,
        parties: s.parties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),
    setAccountOpening: (id, opening) =>
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => (a.id === id ? { ...a, opening } : a)),
      })),
    setClient: (id, patch) =>
      setState((s) => ({
        ...s,
        roveClients: s.roveClients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    addClient: (c) =>
      setState((s) => ({ ...s, roveClients: [...s.roveClients, { ...c, id: uid("c") }] })),
    allocate: (parts) =>
      setState((s) => {
        const at = s.asOf;
        const extra: Movement[] = parts
          .filter((p) => p.amount > 0)
          .map((p) => ({
            id: uid("a"),
            at,
            kind: "alocacao",
            amount: p.amount,
            from: { type: "unallocated" },
            to: { type: "envelope", id: p.envelopeId },
            entityId: "pessoal",
            envelopeId: p.envelopeId,
            note: "Alocação de bolso",
          }));
        return { ...s, movements: [...extra, ...s.movements] };
      }),
    reset: () => {
      localStorage.removeItem(KEY);
      setState(seedState());
    },
    setMonth: (month) => setState((s) => ({ ...s, month })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider em falta");
  return ctx;
}
