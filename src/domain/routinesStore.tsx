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
  createRoutine,
  isoWeekday,
  loadRoutines,
  mergeRoutines,
  saveRoutines,
  todayYmd,
  touchRoutine,
  type Routine,
  type Weekday,
} from "./routines";
import {
  deleteRemoteRoutine,
  fetchRemoteRoutines,
  pushRemoteRoutine,
  pushRemoteRoutines,
} from "./routinesRemote";
import type { TaskDayBlock } from "./tasks";
import { focusTodayCount, MAX_FOCUS_TODAY } from "./tasks";
import { useTasks } from "./tasksStore";

type RoutineDraft = {
  entityId: EntityId;
  title: string;
  note?: string;
  weekday: Weekday;
  timeboxMin?: number;
  dayBlock?: TaskDayBlock;
  focusToday?: boolean;
  active?: boolean;
};

export type RoutinesSyncStatus = "local" | "loading" | "synced" | "saving" | "error" | "offline";

type RoutinesApi = {
  routines: Routine[];
  syncStatus: RoutinesSyncStatus;
  syncError: string;
  add: (draft: RoutineDraft) => { ok: true } | { ok: false; reason: string };
  update: (
    id: string,
    patch: Partial<
      Pick<
        Routine,
        | "title"
        | "note"
        | "weekday"
        | "timeboxMin"
        | "dayBlock"
        | "focusToday"
        | "active"
        | "entityId"
        | "sortOrder"
      >
    >,
  ) => { ok: true } | { ok: false; reason: string };
  remove: (id: string) => void;
  spawnToday: () => number;
  pushNow: () => Promise<void>;
};

const Ctx = createContext<RoutinesApi | null>(null);

const DIRTY_KEY = "ph-rotinas-dirty-v1";
const PENDING_DELETE_KEY = "ph-rotinas-pending-delete-v1";
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

function alreadySpawnedToday(tasks: { routineId: string; due: string; at: string }[], routineId: string, ymd: string) {
  return tasks.some(
    (t) => t.routineId === routineId && (t.due === ymd || t.at === ymd),
  );
}

export function RoutinesProvider({ children }: { children: ReactNode }) {
  const { tasks, add: addTask, syncStatus: tasksSync } = useTasks();
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines());
  const [syncStatus, setSyncStatus] = useState<RoutinesSyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const routinesRef = useRef(routines);
  const dirtyRef = useRef(loadIdSet(DIRTY_KEY));
  const pendingDeleteRef = useRef(loadIdSet(PENDING_DELETE_KEY));
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const missingConfig = useRef(false);
  const spawnedYmdRef = useRef("");

  routinesRef.current = routines;

  const persistLocal = useCallback((next: Routine[]) => {
    setRoutines(next);
    saveRoutines(next);
  }, []);

  const markDirty = useCallback((ids: string[]) => {
    for (const id of ids) dirtyRef.current.add(id);
    saveIdSet(DIRTY_KEY, dirtyRef.current);
  }, []);

  const markPendingDelete = useCallback((id: string) => {
    pendingDeleteRef.current.add(id);
    dirtyRef.current.delete(id);
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);
    saveIdSet(DIRTY_KEY, dirtyRef.current);
  }, []);

  const flushPending = useCallback(async () => {
    if (missingConfig.current) return;
    const dirtyIds = [...dirtyRef.current];
    const deleteIds = [...pendingDeleteRef.current];
    if (dirtyIds.length === 0 && deleteIds.length === 0) return;

    setSyncStatus("saving");
    setSyncError("");

    for (const id of deleteIds) {
      const r = await deleteRemoteRoutine(id);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      pendingDeleteRef.current.delete(id);
    }
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);

    const toPush = routinesRef.current.filter((r) => dirtyRef.current.has(r.id));
    if (toPush.length === 1) {
      const r = await pushRemoteRoutine(toPush[0]);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      dirtyRef.current.delete(toPush[0].id);
      persistLocal(
        routinesRef.current.map((x) => (x.id === r.routine.id ? r.routine : x)),
      );
    } else if (toPush.length > 1) {
      const r = await pushRemoteRoutines(toPush);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      for (const x of toPush) dirtyRef.current.delete(x.id);
      persistLocal(mergeRoutines(routinesRef.current, r.routines));
    }
    saveIdSet(DIRTY_KEY, dirtyRef.current);
    retryAttempt.current = 0;
    setSyncStatus("synced");

    function scheduleRetry() {
      if (retryAttempt.current >= MAX_RETRIES) {
        setSyncStatus("offline");
        return;
      }
      const delay = RETRY_BASE_MS * 2 ** retryAttempt.current;
      retryAttempt.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        void flushPending();
      }, delay);
    }
  }, [persistLocal]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      void flushPending();
    }, 450);
  }, [flushPending]);

  const persist = useCallback(
    (next: Routine[], dirtyIds: string[]) => {
      persistLocal(next);
      markDirty(dirtyIds);
      scheduleFlush();
    },
    [markDirty, persistLocal, scheduleFlush],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteRoutines();
      if (cancelled) return;
      if (!remote.ok) {
        if (remote.missingConfig) {
          missingConfig.current = true;
          setSyncStatus("local");
          setSyncError(remote.reason);
          return;
        }
        setSyncStatus("offline");
        setSyncError(remote.reason);
        return;
      }
      const merged = mergeRoutines(loadRoutines(), remote.routines);
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
  }, [persistLocal, scheduleFlush]);

  const pushNow = useCallback(async () => {
    if (missingConfig.current) return;
    retryAttempt.current = 0;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (dirtyRef.current.size === 0 && pendingDeleteRef.current.size === 0) {
      for (const r of routinesRef.current) dirtyRef.current.add(r.id);
      saveIdSet(DIRTY_KEY, dirtyRef.current);
    }
    await flushPending();
  }, [flushPending]);

  const add: RoutinesApi["add"] = useCallback(
    (draft) => {
      const title = draft.title.trim();
      if (!title) return { ok: false, reason: "Título obrigatório." };
      const created = createRoutine({ ...draft, title });
      persist([created, ...routines], [created.id]);
      return { ok: true };
    },
    [persist, routines],
  );

  const update: RoutinesApi["update"] = useCallback(
    (id, patch) => {
      const target = routines.find((r) => r.id === id);
      if (!target) return { ok: false, reason: "Rotina em falta." };
      const next = routines.map((r) =>
        r.id === id
          ? touchRoutine({
              ...r,
              title: patch.title !== undefined ? patch.title.trim() : r.title,
              note: patch.note !== undefined ? patch.note.trim() : r.note,
              weekday: patch.weekday !== undefined ? patch.weekday : r.weekday,
              timeboxMin: patch.timeboxMin !== undefined ? patch.timeboxMin : r.timeboxMin,
              dayBlock: patch.dayBlock !== undefined ? patch.dayBlock : r.dayBlock,
              focusToday: patch.focusToday !== undefined ? patch.focusToday : r.focusToday,
              active: patch.active !== undefined ? patch.active : r.active,
              entityId: patch.entityId !== undefined ? patch.entityId : r.entityId,
              sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : r.sortOrder,
            })
          : r,
      );
      persist(next, [id]);
      return { ok: true };
    },
    [persist, routines],
  );

  const remove: RoutinesApi["remove"] = useCallback(
    (id) => {
      persistLocal(routines.filter((r) => r.id !== id));
      markPendingDelete(id);
      scheduleFlush();
    },
    [markPendingDelete, persistLocal, scheduleFlush, routines],
  );

  const spawnToday = useCallback(() => {
    const ymd = todayYmd();
    const wd = isoWeekday();
    let created = 0;
    let focusCreated = 0;
    const snapshot = [...routines];
    const dirtySpawn: string[] = [];

    for (const r of routines) {
      if (!r.active || r.weekday !== wd) continue;
      if (r.lastSpawnYmd === ymd) continue;
      if (alreadySpawnedToday(tasks, r.id, ymd)) {
        dirtySpawn.push(r.id);
        continue;
      }

      let focus = r.focusToday;
      if (
        focus &&
        focusTodayCount(tasks, r.entityId) + focusCreated >= MAX_FOCUS_TODAY
      ) {
        focus = false;
      }

      const result = addTask({
        entityId: r.entityId,
        title: r.title,
        note: r.note,
        due: ymd,
        at: ymd,
        status: "para_fazer",
        focusToday: focus,
        timeboxMin: r.timeboxMin,
        dayBlock: r.dayBlock,
        routineId: r.id,
      });
      if (result.ok) {
        created += 1;
        if (focus) focusCreated += 1;
        dirtySpawn.push(r.id);
      }
    }

    if (dirtySpawn.length) {
      const next = snapshot.map((r) =>
        dirtySpawn.includes(r.id) ? touchRoutine({ ...r, lastSpawnYmd: ymd }) : r,
      );
      persist(next, dirtySpawn);
    }
    spawnedYmdRef.current = ymd;
    return created;
  }, [addTask, persist, routines, tasks]);

  useEffect(() => {
    if (tasksSync === "loading") return;
    if (syncStatus === "loading") return;
    const ymd = todayYmd();
    if (spawnedYmdRef.current === ymd) return;
    spawnToday();
  }, [spawnToday, syncStatus, tasksSync]);

  const value = useMemo(
    () => ({
      routines,
      syncStatus,
      syncError,
      add,
      update,
      remove,
      spawnToday,
      pushNow,
    }),
    [routines, syncStatus, syncError, add, update, remove, spawnToday, pushNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoutines() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRoutines fora de RoutinesProvider");
  return ctx;
}
