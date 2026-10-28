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
  createProject,
  loadProjects,
  mergeProjects,
  saveProjects,
  touchProject,
  type Project,
  type ProjectStatus,
} from "./projects";
import {
  deleteRemoteProject,
  fetchRemoteProjects,
  pushRemoteProject,
  pushRemoteProjects,
} from "./projectsRemote";

type ProjectDraft = {
  name: string;
  note?: string;
  status?: ProjectStatus;
  due?: string;
  entityId?: EntityId;
};

export type ProjectsSyncStatus = "local" | "loading" | "synced" | "saving" | "error" | "offline";

type ProjectsApi = {
  projects: Project[];
  syncStatus: ProjectsSyncStatus;
  syncError: string;
  add: (draft: ProjectDraft) => { ok: true; id: string } | { ok: false; reason: string };
  update: (
    id: string,
    patch: Partial<Pick<Project, "name" | "note" | "status" | "due" | "entityId">>,
  ) => { ok: true } | { ok: false; reason: string };
  remove: (id: string) => void;
  pushNow: () => Promise<void>;
};

const Ctx = createContext<ProjectsApi | null>(null);

const DIRTY_KEY = "ph-projectos-dirty-v1";
const PENDING_DELETE_KEY = "ph-projectos-pending-delete-v1";
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

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [syncStatus, setSyncStatus] = useState<ProjectsSyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const projectsRef = useRef(projects);
  const dirtyRef = useRef(loadIdSet(DIRTY_KEY));
  const pendingDeleteRef = useRef(loadIdSet(PENDING_DELETE_KEY));
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const missingConfig = useRef(false);

  projectsRef.current = projects;

  const persistLocal = useCallback((next: Project[]) => {
    setProjects(next);
    saveProjects(next);
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
    const deleteIds = [...pendingDeleteRef.current];
    const dirtyIds = [...dirtyRef.current];
    if (dirtyIds.length === 0 && deleteIds.length === 0) return;

    setSyncStatus("saving");
    setSyncError("");

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

    for (const id of deleteIds) {
      const r = await deleteRemoteProject(id);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      pendingDeleteRef.current.delete(id);
    }
    saveIdSet(PENDING_DELETE_KEY, pendingDeleteRef.current);

    const toPush = projectsRef.current.filter((p) => dirtyRef.current.has(p.id));
    if (toPush.length === 1) {
      const r = await pushRemoteProject(toPush[0]);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      dirtyRef.current.delete(toPush[0].id);
      persistLocal(projectsRef.current.map((x) => (x.id === r.project.id ? r.project : x)));
    } else if (toPush.length > 1) {
      const r = await pushRemoteProjects(toPush);
      if (!r.ok) {
        setSyncStatus("error");
        setSyncError(r.reason);
        scheduleRetry();
        return;
      }
      for (const x of toPush) dirtyRef.current.delete(x.id);
      persistLocal(mergeProjects(projectsRef.current, r.projects));
    }
    saveIdSet(DIRTY_KEY, dirtyRef.current);
    retryAttempt.current = 0;
    setSyncStatus("synced");
  }, [persistLocal]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      void flushPending();
    }, 450);
  }, [flushPending]);

  const persist = useCallback(
    (next: Project[], dirtyIds: string[]) => {
      persistLocal(next);
      markDirty(dirtyIds);
      scheduleFlush();
    },
    [markDirty, persistLocal, scheduleFlush],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteProjects();
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
      const merged = mergeProjects(loadProjects(), remote.projects).filter(
        (p) => !pendingDeleteRef.current.has(p.id),
      );
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
      for (const p of projectsRef.current) dirtyRef.current.add(p.id);
      saveIdSet(DIRTY_KEY, dirtyRef.current);
    }
    await flushPending();
  }, [flushPending]);

  const add: ProjectsApi["add"] = useCallback(
    (draft) => {
      const name = draft.name.trim();
      if (!name) return { ok: false, reason: "Indica o nome do projecto." };
      const created = createProject({ ...draft, name });
      persist([created, ...projects], [created.id]);
      return { ok: true, id: created.id };
    },
    [persist, projects],
  );

  const update: ProjectsApi["update"] = useCallback(
    (id, patch) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return { ok: false, reason: "Projecto em falta." };
      const next = projects.map((p) =>
        p.id === id
          ? touchProject({
              ...p,
              name: patch.name !== undefined ? patch.name.trim() || p.name : p.name,
              note: patch.note !== undefined ? patch.note.trim() : p.note,
              status: patch.status !== undefined ? patch.status : p.status,
              due: patch.due !== undefined ? patch.due.trim() : p.due,
              entityId: patch.entityId !== undefined ? patch.entityId : p.entityId,
            })
          : p,
      );
      persist(next, [id]);
      return { ok: true };
    },
    [persist, projects],
  );

  const remove: ProjectsApi["remove"] = useCallback(
    (id) => {
      persistLocal(projects.filter((p) => p.id !== id));
      markPendingDelete(id);
      scheduleFlush();
    },
    [markPendingDelete, persistLocal, scheduleFlush, projects],
  );

  const value = useMemo(
    () => ({ projects, syncStatus, syncError, add, update, remove, pushNow }),
    [projects, syncStatus, syncError, add, update, remove, pushNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects fora de ProjectsProvider");
  return ctx;
}
