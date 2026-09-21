import type { EntityId } from "./types";
import type { TaskDayBlock } from "./tasks";

/** 0 = segunda … 6 = domingo */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Routine = {
  id: string;
  entityId: EntityId;
  title: string;
  note: string;
  weekday: Weekday;
  timeboxMin: number;
  dayBlock: TaskDayBlock;
  focusToday: boolean;
  active: boolean;
  sortOrder: number;
  lastSpawnYmd: string;
  updatedAt: string;
};

export const ROUTINES_STORAGE_KEY = "ph-rotinas-v1";

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Segunda",
  1: "Terça",
  2: "Quarta",
  3: "Quinta",
  4: "Sexta",
  5: "Sábado",
  6: "Domingo",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Seg",
  1: "Ter",
  2: "Qua",
  3: "Qui",
  4: "Sex",
  5: "Sáb",
  6: "Dom",
};

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function uid() {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeDayBlock(raw: unknown): TaskDayBlock {
  if (raw === "manha" || raw === "tarde" || raw === "noite") return raw;
  return "";
}

function normalizeTimebox(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(480, Math.round(n));
}

function normalizeWeekday(raw: unknown): Weekday | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n as Weekday;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS getDay (0=dom) → ISO weekday (0=seg). */
export function isoWeekday(d = new Date()): Weekday {
  return ((d.getDay() + 6) % 7) as Weekday;
}

export function touchRoutine(r: Routine): Routine {
  return { ...r, updatedAt: nowIso() };
}

export function createRoutine(draft: {
  entityId: EntityId;
  title: string;
  note?: string;
  weekday: Weekday;
  timeboxMin?: number;
  dayBlock?: TaskDayBlock;
  focusToday?: boolean;
  active?: boolean;
  sortOrder?: number;
}): Routine {
  return {
    id: uid(),
    entityId: draft.entityId,
    title: draft.title.trim(),
    note: (draft.note ?? "").trim(),
    weekday: draft.weekday,
    timeboxMin: normalizeTimebox(draft.timeboxMin ?? 0),
    dayBlock: draft.dayBlock ?? "",
    focusToday: Boolean(draft.focusToday),
    active: draft.active === undefined ? true : Boolean(draft.active),
    sortOrder: draft.sortOrder ?? 0,
    lastSpawnYmd: "",
    updatedAt: nowIso(),
  };
}

export function coerceRoutine(x: unknown): Routine | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.entityId !== "string" || typeof r.title !== "string") {
    return null;
  }
  const weekday = normalizeWeekday(r.weekday);
  if (weekday === null) return null;
  const updatedAt =
    typeof r.updatedAt === "string" && r.updatedAt
      ? r.updatedAt
      : typeof r.updated_at === "string" && r.updated_at
        ? r.updated_at
        : nowIso();
  return {
    id: r.id,
    entityId: r.entityId as EntityId,
    title: r.title,
    note: typeof r.note === "string" ? r.note : "",
    weekday,
    timeboxMin: normalizeTimebox(r.timeboxMin ?? r.timebox_min),
    dayBlock: normalizeDayBlock(r.dayBlock ?? r.day_block),
    focusToday: Boolean(r.focusToday ?? r.focus_today),
    active: r.active === undefined ? true : Boolean(r.active),
    sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0) || 0,
    lastSpawnYmd: String(r.lastSpawnYmd ?? r.last_spawn_ymd ?? ""),
    updatedAt,
  };
}

export function loadRoutines(): Routine[] {
  try {
    const raw = localStorage.getItem(ROUTINES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceRoutine).filter((r): r is Routine => r !== null);
  } catch {
    return [];
  }
}

export function saveRoutines(routines: Routine[]) {
  localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
}

export function mergeRoutines(local: Routine[], remote: Routine[]): Routine[] {
  const map = new Map<string, Routine>();
  for (const r of remote) map.set(r.id, r);
  for (const r of local) {
    const cur = map.get(r.id);
    if (!cur || r.updatedAt >= cur.updatedAt) map.set(r.id, r);
  }
  return [...map.values()].sort(
    (a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

export function routinesForWeekday(routines: Routine[], weekday: Weekday): Routine[] {
  return routines
    .filter((r) => r.active && r.weekday === weekday)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
