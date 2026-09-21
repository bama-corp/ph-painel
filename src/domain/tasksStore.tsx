import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EntityId } from "./types";
import {
  createTask,
  ensureSeededTasks,
  executarWipCount,
  focusTodayCount,
  loadTasks,
  MAX_FOCUS_TODAY,
  mergeTasks,
  saveTasks,
  touchTask,
  WIP_EXECUTAR_LIMIT,
  type Task,
  type TaskQuadrant,
  type TaskStatus,
} from "./tasks";
import {
  deleteRemoteTask,
  fetchRemoteTasks,
  pushRemoteTask,
  pushRemoteTasks,
} from "./tasksRemote";

type TaskDraft = {
  entityId: EntityId;
  title: string;
  note?: string;
  due?: string;
  status?: TaskStatus;
  quadrant?: TaskQuadrant;
  focusToday?: boolean;
};

export type TasksSyncStatus = "local" | "loading" | "synced" | "saving" | "error" | "offline";

type TasksApi = {
  tasks: Task[];
  syncStatus: TasksSyncStatus;
  syncError: string;
  add: (draft: TaskDraft) => { ok: true } | { ok: false; reason: string };
  setStatus: (id: string, status: TaskStatus) => { ok: true } | { ok: false; reason: string };
  setQuadrant: (id: string, quadrant: TaskQuadrant) => void;
  toggleFocusToday: (id: string) => { ok: true } | { ok: false; reason: string };
  update: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        "title" | "note" | "due" | "quadrant" | "focusToday" | "status" | "timeboxMin" | "dayBlock"
      >
    >,
  ) => { ok: true } | { ok: false; reason: string };
  remove: (id: string) => void;
  pushNow: () => Promise<void>;
};

const Ctx = createContext<TasksApi | null>(null);

const DIRTY_KEY = "ph-tarefas-dirty-v1";
const PENDING_DELETE_KEY = "ph-tarefas-pending-delete-v1";
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 800;

function loadIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => ensureSeededTasks(loadTasks()).tasks);
  const [syncStatus, setSyncStatus] = useState<TasksSyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const dirtyRef = useRef<Set<string>>(loadIdSet(DIRTY_KEY));
  const pendingDeleteRef = useRef<Set<string>>(loadIdSet(PENDING_DELETE_KEY));
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const flushing = useRef(false);
  const missingConfig = useRef(false);
  const flushPendingRef = useRef<() => Promise<void>>(async () => {});

  const persistLocal = useCallback((next: Task[]) => {
    setTasks(next);
    saveTasks(next);
  }, []);

  const applyDemoSeed = useCallback((list: Task[]) => {
    const base = list.filter((t) => !pendingDeleteRef.current.has(t.id));
    const { tasks: next, addedIds } = ensureSeededTasks(base);
    const fresh = addedIds.filter((id) => !pendingDeleteRef.current.has(id));
    if (fresh.length) {
      for (const id of fresh) dirtyRef.current.add(id);
      saveIdSet(DIRTY_KEY, dirtyRef.current);
    }
    return fresh.length
      ? next.filter((t) => !pendingDeleteRef.current.has(t.id))
      : base;
  }, []);

  const markDirty = useCallback((ids: string[]) => {
    for (const id of ids) {
      dirtyRef.current.add(id);
      pendingDeleteRef.current.delete(id);
    }
    saveIdSet(DIRTY_KEY, dirtyRef.current);
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);
  }, []);

  const markPendingDelete = useCallback((id: string) => {
    dirtyRef.current.delete(id);
    pendingDeleteRef.current.add(id);
    saveIdSet(DIRTY_KEY, dirtyRef.current);
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);
  }, []);

  const clearDirty = useCallback((ids: string[]) => {
    for (const id of ids) dirtyRef.current.delete(id);
    saveIdSet(DIRTY_KEY, dirtyRef.current);
  }, []);

  const clearPendingDelete = useCallback((ids: string[]) => {
    for (const id of ids) pendingDeleteRef.current.delete(id);
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);
  }, []);

  const flushPending = useCallback(async () => {
    if (missingConfig.current || flushing.current) return;
    const dirtyIds = [...dirtyRef.current];
    const deleteIds = [...pendingDeleteRef.current];
    if (dirtyIds.length === 0 && deleteIds.length === 0) {
      setSyncStatus((s) => (s === "saving" || s === "error" || s === "offline" ? "synced" : s));
      setSyncError("");
      retryAttempt.current = 0;
      return;
    }

    flushing.current = true;
    setSyncStatus("saving");

    try {
      const toUpsert = tasksRef.current.filter((t) => dirtyRef.current.has(t.id));
      let failed = false;
      let lastReason = "";

      if (toUpsert.length === 1) {
        const r = await pushRemoteTask(toUpsert[0]);
        if (!r.ok) {
          failed = true;
          lastReason = r.reason;
        } else {
          clearDirty([r.task.id]);
          const next = tasksRef.current.map((t) => (t.id === r.task.id ? r.task : t));
          persistLocal(next);
        }
      } else if (toUpsert.length > 1) {
        const r = await pushRemoteTasks(toUpsert);
        if (!r.ok) {
          failed = true;
          lastReason = r.reason;
        } else {
          clearDirty(toUpsert.map((t) => t.id));
          const byId = new Map(r.tasks.map((t) => [t.id, t]));
          const next = tasksRef.current.map((t) => byId.get(t.id) ?? t);
          persistLocal(next);
        }
      }

      for (const id of deleteIds) {
        if (!pendingDeleteRef.current.has(id)) continue;
        const r = await deleteRemoteTask(id);
        if (!r.ok) {
          failed = true;
          lastReason = r.reason;
        } else {
          clearPendingDelete([id]);
        }
      }

      if (failed) {
        setSyncStatus("error");
        setSyncError(lastReason || "Falha ao sincronizar.");
        if (retryAttempt.current < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * 2 ** retryAttempt.current;
          retryAttempt.current += 1;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            void flushPendingRef.current();
          }, delay);
        }
        return;
      }

      retryAttempt.current = 0;
      setSyncStatus("synced");
      setSyncError("");
    } finally {
      flushing.current = false;
    }
  }, [clearDirty, clearPendingDelete, persistLocal]);

  flushPendingRef.current = flushPending;

  const scheduleFlush = useCallback(() => {
    if (missingConfig.current) return;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      void flushPendingRef.current();
    }, 450);
  }, []);

  const persist = useCallback(
    (next: Task[], dirtyIds: string[]) => {
      persistLocal(next);
      if (dirtyIds.length) markDirty(dirtyIds);
      scheduleFlush();
    },
    [markDirty, persistLocal, scheduleFlush],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSyncStatus("loading");
      const local = applyDemoSeed(loadTasks());
      persistLocal(local);

      const r = await fetchRemoteTasks();
      if (cancelled) return;
      if (!r.ok) {
        if (r.missingConfig) {
          missingConfig.current = true;
          setSyncStatus("local");
          setSyncError(r.reason);
        } else {
          setSyncStatus("offline");
          setSyncError(r.reason);
        }
        return;
      }
      const merged = applyDemoSeed(mergeTasks(local, r.tasks, pendingDeleteRef.current));
      persistLocal(merged);
      setSyncStatus("synced");
      setSyncError("");
      if (dirtyRef.current.size > 0 || pendingDeleteRef.current.size > 0) {
        scheduleFlush();
      }
    })();
    return () => {
      cancelled = true;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [applyDemoSeed, persistLocal, scheduleFlush]);

  const pushNow = useCallback(async () => {
    if (missingConfig.current) return;
    retryAttempt.current = 0;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (dirtyRef.current.size === 0 && pendingDeleteRef.current.size === 0) {
      for (const t of tasksRef.current) dirtyRef.current.add(t.id);
      saveIdSet(DIRTY_KEY, dirtyRef.current);
    }
    await flushPending();
  }, [flushPending]);

  const add: TasksApi["add"] = useCallback(
    (draft) => {
      const title = draft.title.trim();
      if (!title) return { ok: false, reason: "Título obrigatório." };
      if (draft.focusToday && focusTodayCount(tasks, draft.entityId) >= MAX_FOCUS_TODAY) {
        return { ok: false, reason: `No máximo ${MAX_FOCUS_TODAY} prioridades «Hoje».` };
      }
      const created = createTask({ ...draft, title });
      persist([created, ...tasks], [created.id]);
      return { ok: true };
    },
    [persist, tasks],
  );

  const setStatus: TasksApi["setStatus"] = useCallback(
    (id, status) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return { ok: false, reason: "Tarefa em falta." };
      if (
        status === "executar" &&
        target.status !== "executar" &&
        executarWipCount(tasks, target.entityId) >= WIP_EXECUTAR_LIMIT
      ) {
        return {
          ok: false,
          reason: `WIP Executar cheio (${WIP_EXECUTAR_LIMIT}). Conclui ou move uma antes.`,
        };
      }
      const next = tasks.map((t) => (t.id === id ? touchTask({ ...t, status }) : t));
      persist(next, [id]);
      return { ok: true };
    },
    [persist, tasks],
  );

  const setQuadrant: TasksApi["setQuadrant"] = useCallback(
    (id, quadrant) => {
      const next = tasks.map((t) => (t.id === id ? touchTask({ ...t, quadrant }) : t));
      persist(next, [id]);
    },
    [persist, tasks],
  );

  const toggleFocusToday: TasksApi["toggleFocusToday"] = useCallback(
    (id) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return { ok: false, reason: "Tarefa em falta." };
      if (!target.focusToday && focusTodayCount(tasks, target.entityId) >= MAX_FOCUS_TODAY) {
        return { ok: false, reason: `No máximo ${MAX_FOCUS_TODAY} prioridades «Hoje».` };
      }
      const next = tasks.map((t) =>
        t.id === id ? touchTask({ ...t, focusToday: !t.focusToday }) : t,
      );
      persist(next, [id]);
      return { ok: true };
    },
    [persist, tasks],
  );

  const update: TasksApi["update"] = useCallback(
    (id, patch) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return { ok: false, reason: "Tarefa em falta." };
      if (
        patch.status === "executar" &&
        target.status !== "executar" &&
        executarWipCount(tasks, target.entityId) >= WIP_EXECUTAR_LIMIT
      ) {
        return {
          ok: false,
          reason: `WIP Executar cheio (${WIP_EXECUTAR_LIMIT}). Conclui ou move uma antes.`,
        };
      }
      const next = tasks.map((t) =>
        t.id === id
          ? touchTask({
              ...t,
              title: patch.title !== undefined ? patch.title.trim() : t.title,
              note: patch.note !== undefined ? patch.note.trim() : t.note,
              due: patch.due !== undefined ? patch.due.trim() : t.due,
              quadrant: patch.quadrant !== undefined ? patch.quadrant : t.quadrant,
              focusToday: patch.focusToday !== undefined ? patch.focusToday : t.focusToday,
              status: patch.status !== undefined ? patch.status : t.status,
              timeboxMin: patch.timeboxMin !== undefined ? patch.timeboxMin : t.timeboxMin,
              dayBlock: patch.dayBlock !== undefined ? patch.dayBlock : t.dayBlock,
            })
          : t,
      );
      persist(next, [id]);
      return { ok: true };
    },
    [persist, tasks],
  );

  const remove: TasksApi["remove"] = useCallback(
    (id) => {
      persistLocal(tasks.filter((t) => t.id !== id));
      markPendingDelete(id);
      scheduleFlush();
    },
    [markPendingDelete, persistLocal, scheduleFlush, tasks],
  );

  const value = useMemo(
    () => ({
      tasks,
      syncStatus,
      syncError,
      add,
      setStatus,
      setQuadrant,
      toggleFocusToday,
      update,
      remove,
      pushNow,
    }),
    [
      tasks,
      syncStatus,
      syncError,
      add,
      setStatus,
      setQuadrant,
      toggleFocusToday,
      update,
      remove,
      pushNow,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTasks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTasks fora de TasksProvider");
  return ctx;
}
