import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  syncDeclaredSalary,
  type AllocateResult,
  type MovementResult,
} from "./engine";
import { downloadStateJson, exportStateJson, importStateJson, loadState, STORAGE_KEY } from "./persist";
import { fetchRemoteState, pushRemoteState } from "./remote";
import { seedState } from "./seed";
import {
  applySplitMethodRules,
  detectBudgetMethodId,
} from "./definicaoRules";
import type { AppState, BudgetRules, IncomeSource, Movement, NotebookEntry, Party, RoveClient } from "./types";
import { roundKz, uid } from "./money";

type Store = {
  state: AppState;
  ready: boolean;
  syncStatus: "idle" | "loading" | "saving" | "synced" | "offline" | "error";
  syncError: string | null;
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
  setBudgetMethod: (methodId: string) => { ok: true } | { ok: false; reason: string };
  setParty: (id: string, patch: Partial<Party>) => void;
  addParty: (p: Omit<Party, "id">) => { ok: true; id: string } | { ok: false; reason: string };
  removeParty: (id: string) => { ok: true } | { ok: false; reason: string };
  setAccountOpening: (id: string, opening: number) => void;
  setClient: (id: string, patch: Partial<RoveClient>) => void;
  addClient: (c: Omit<RoveClient, "id">) => void;
  allocate: (parts: { envelopeId: string; amount: number }[]) => AllocateResult;
  distributeEntry: (amount: number) => AllocateResult;
  addIncomeSource: (draft: Omit<IncomeSource, "id">) => { ok: true; id: string } | { ok: false; reason: string };
  setIncomeSource: (id: string, patch: Partial<Omit<IncomeSource, "id">>) => void;
  removeIncomeSource: (id: string) => { ok: true } | { ok: false; reason: string };
  addNote: (n: Omit<NotebookEntry, "id">) => void;
  setNote: (id: string, patch: Partial<NotebookEntry>) => void;
  removeNote: (id: string) => void;
  reset: () => void;
  setMonth: (month: string) => void;
  exportJson: () => string;
  downloadJson: () => void;
  importJson: (raw: string) => { ok: true } | { ok: false; reason: string };
  pushNow: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Store["syncStatus"]>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const skipPush = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSyncStatus("loading");
      const remote = await fetchRemoteState();
      if (cancelled) return;
      if (remote.ok) {
        setState(remote.state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.state));
        setSyncStatus("synced");
        setSyncError(null);
      } else if (remote.empty) {
        const local = loadState();
        setState(local);
        const pushed = await pushRemoteState(local);
        setSyncStatus(pushed.ok ? "synced" : "offline");
        setSyncError(pushed.ok ? null : pushed.reason);
      } else {
        setState(loadState());
        setSyncStatus("offline");
        setSyncError(remote.reason);
      }
      skipPush.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncStatus("saving");
      const r = await pushRemoteState(state);
      if (r.ok) {
        setSyncStatus("synced");
        setSyncError(null);
      } else {
        setSyncStatus("error");
        setSyncError(r.reason);
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, ready]);

  async function pushNow() {
    setSyncStatus("saving");
    const r = await pushRemoteState(state);
    if (r.ok) {
      setSyncStatus("synced");
      setSyncError(null);
    } else {
      setSyncStatus("error");
      setSyncError(r.reason);
    }
  }

  const store: Store = {
    state,
    ready,
    syncStatus,
    syncError,
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
    setRules: (rules) =>
      setState((s) => ({
        ...s,
        rules,
        budgetMethodId: detectBudgetMethodId(rules),
      })),
    setBudgetMethod: (methodId) => {
      const applied = applySplitMethodRules(methodId);
      if (!applied.ok) return { ok: false as const, reason: applied.reason };
      setState((s) => ({
        ...s,
        rules: applied.rules,
        budgetMethodId: applied.methodId,
      }));
      return { ok: true as const };
    },
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
    addIncomeSource: (draft) => {
      const name = draft.name.trim();
      if (!name) return { ok: false as const, reason: "Indica o nome da fonte." };
      if (!(draft.amount > 0)) return { ok: false as const, reason: "Valor tem de ser positivo." };
      const id = uid("inc");
      setState((s) =>
        syncDeclaredSalary({
          ...s,
          incomeSources: [
            ...(s.incomeSources ?? []),
            { id, name, amount: roundKz(draft.amount), active: draft.active !== false },
          ],
        }),
      );
      return { ok: true as const, id };
    },
    setIncomeSource: (id, patch) =>
      setState((s) =>
        syncDeclaredSalary({
          ...s,
          incomeSources: (s.incomeSources ?? []).map((src) => {
            if (src.id !== id) return src;
            const next = { ...src, ...patch };
            if (patch.name !== undefined) next.name = patch.name.trim() || src.name;
            if (patch.amount !== undefined) next.amount = roundKz(patch.amount);
            return next;
          }),
        }),
      ),
    removeIncomeSource: (id) => {
      let result: { ok: true } | { ok: false; reason: string } = { ok: false, reason: "Estado indisponível." };
      setState((s) => {
        const list = s.incomeSources ?? [];
        if (!list.some((x) => x.id === id)) {
          result = { ok: false, reason: "Fonte inexistente." };
          return s;
        }
        if (list.length <= 1) {
          result = { ok: false, reason: "Mantém pelo menos uma fonte de renda." };
          return s;
        }
        result = { ok: true };
        return syncDeclaredSalary({
          ...s,
          incomeSources: list.filter((x) => x.id !== id),
        });
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
      const next = seedState();
      skipPush.current = false;
      setState(next);
    },
    setMonth: (month) => setState((s) => ({ ...s, month })),
    exportJson: () => exportStateJson(state),
    downloadJson: () => downloadStateJson(state),
    importJson: (raw) => {
      const r = importStateJson(raw);
      if (!r.ok) return { ok: false as const, reason: r.reason };
      skipPush.current = false;
      setState(r.state);
      return { ok: true as const };
    },
    pushNow,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider em falta");
  return ctx;
}
