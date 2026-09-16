import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  applyAccountOpening,
  applyAddMovement,
  applyAllocate,
  applyDistributeEntry,
  applyPartyOpening,
  applyPartyPayment,
  applyPartyCollection,
  partyHasLedgerMovements,
  partyOf,
  type AllocateResult,
  type MovementResult,
} from "./engine";
import { downloadStateJson, exportStateJson, importStateJson, loadState, STORAGE_KEY } from "./persist";
import { seedState } from "./seed";
import type { AppState, BudgetRules, Movement, NotebookEntry, Party, RoveClient } from "./types";
import { uid } from "./money";

type Store = {
  state: AppState;
  addMovement: (m: Omit<Movement, "id">) => MovementResult;
  payParty: (opts: {
    partyId: string;
    accountId: string;
    amount: number;
    at?: string;
    note?: string;
  }) => MovementResult;
  collectParty: (opts: {
    partyId: string;
    accountId: string;
    amount: number;
    at?: string;
    note?: string;
  }) => MovementResult;
  setRules: (r: BudgetRules) => void;
  setParty: (id: string, patch: Partial<Party>) => void;
  addParty: (p: Omit<Party, "id">) => { ok: true; id: string } | { ok: false; reason: string };
  removeParty: (id: string) => { ok: true } | { ok: false; reason: string };
  setAccountOpening: (id: string, opening: number) => void;
  setClient: (id: string, patch: Partial<RoveClient>) => void;
  addClient: (c: Omit<RoveClient, "id">) => void;
  allocate: (parts: { envelopeId: string; amount: number }[]) => AllocateResult;
  distributeEntry: (amount: number) => AllocateResult;
  addNote: (n: Omit<NotebookEntry, "id">) => void;
  setNote: (id: string, patch: Partial<NotebookEntry>) => void;
  removeNote: (id: string) => void;
  reset: () => void;
  setMonth: (month: string) => void;
  exportJson: () => string;
  downloadJson: () => void;
  importJson: (raw: string) => { ok: true } | { ok: false; reason: string };
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const store: Store = {
    state,
    addMovement: (m) => {
      let result: MovementResult = { ok: false, reason: "Estado indisponível.", state };
      setState((s) => {
        result = applyAddMovement(s, m, uid("m"));
        return result.ok ? result.state : s;
      });
      return result;
    },
    payParty: (opts) => {
      let result: MovementResult = { ok: false, reason: "Estado indisponível.", state };
      setState((s) => {
        result = applyPartyPayment(s, { ...opts, id: uid("m") });
        return result.ok ? result.state : s;
      });
      return result;
    },
    collectParty: (opts) => {
      let result: MovementResult = { ok: false, reason: "Estado indisponível.", state };
      setState((s) => {
        result = applyPartyCollection(s, { ...opts, id: uid("m") });
        return result.ok ? result.state : s;
      });
      return result;
    },
    setRules: (rules) => setState((s) => ({ ...s, rules })),
    setParty: (id, patch) =>
      setState((s) => {
        const { opening, ...rest } = patch;
        let next = s;
        if (opening !== undefined) {
          const r = applyPartyOpening(s, id, opening);
          if (r.ok) next = r.state;
        }
        if (Object.keys(rest).length === 0) return next;
        return {
          ...next,
          parties: next.parties.map((p) => (p.id === id ? { ...p, ...rest } : p)),
        };
      }),
    addParty: (draft) => {
      const name = draft.name.trim();
      if (!name) return { ok: false as const, reason: "Indica o nome." };
      if (draft.opening < 0) return { ok: false as const, reason: "Valor não pode ser negativo." };
      if (draft.ownership === "company") {
        return { ok: false as const, reason: "Parties empresa usam conta corrente — não este formulário." };
      }
      const id = uid("p");
      setState((s) => ({
        ...s,
        parties: [
          ...s.parties,
          {
            ...draft,
            id,
            name,
            opening: draft.opening || 0,
            unknown: draft.unknown ?? draft.opening === 0,
          },
        ],
      }));
      return { ok: true as const, id };
    },
    removeParty: (id) => {
      let result: { ok: true } | { ok: false; reason: string } = { ok: false, reason: "Estado indisponível." };
      setState((s) => {
        const p = s.parties.find((x) => x.id === id);
        if (!p) {
          result = { ok: false, reason: "Party inexistente." };
          return s;
        }
        if (p.role === "owner_current") {
          result = { ok: false, reason: "Conta corrente do proprietário não se remove aqui." };
          return s;
        }
        if (partyHasLedgerMovements(s, id)) {
          result = { ok: false, reason: "Há movimentos. Zera com pagamento/cobrança, não apagues o histórico." };
          return s;
        }
        if (partyOf(s, id) > 0.001) {
          result = { ok: false, reason: "Saldo ainda positivo. Paga/recebe ou põe opening a 0 primeiro." };
          return s;
        }
        result = { ok: true };
        return { ...s, parties: s.parties.filter((x) => x.id !== id) };
      });
      return result;
    },
    setAccountOpening: (id, opening) =>
      setState((s) => {
        const r = applyAccountOpening(s, id, opening);
        return r.ok ? r.state : s;
      }),
    setClient: (id, patch) =>
      setState((s) => ({
        ...s,
        roveClients: s.roveClients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    addClient: (c) =>
      setState((s) => ({ ...s, roveClients: [...s.roveClients, { ...c, id: uid("c") }] })),
    allocate: (parts) => {
      let result: AllocateResult = { ok: false, reason: "Estado indisponível.", state };
      setState((s) => {
        result = applyAllocate(s, parts);
        return result.ok ? result.state : s;
      });
      return result;
    },
    distributeEntry: (amount) => {
      let result: AllocateResult = { ok: false, reason: "Estado indisponível.", state };
      setState((s) => {
        result = applyDistributeEntry(s, amount);
        return result.ok ? result.state : s;
      });
      return result;
    },
    addNote: (n) =>
      setState((s) => ({ ...s, notes: [{ ...n, id: uid("n") }, ...s.notes] })),
    setNote: (id, patch) =>
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })),
    removeNote: (id) => setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      setState(seedState());
    },
    setMonth: (month) => setState((s) => ({ ...s, month })),
    exportJson: () => exportStateJson(state),
    downloadJson: () => downloadStateJson(state),
    importJson: (raw) => {
      const r = importStateJson(raw);
      if (!r.ok) return { ok: false as const, reason: r.reason };
      setState(r.state);
      return { ok: true as const };
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider em falta");
  return ctx;
}
