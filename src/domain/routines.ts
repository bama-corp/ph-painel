import type { EntityId } from "./types";
import type { TaskArea, TaskDayBlock } from "./tasks";
import { normalizeArea } from "./tasks";

/** 0 = segunda … 6 = domingo */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Routine = {
  id: string;
  entityId: EntityId;
  title: string;
  note: string;
  weekday: Weekday;
  /** HH:mm. Vazio = sem hora marcada. */
  startsAt: string;
  timeboxMin: number;
  dayBlock: TaskDayBlock;
  focusToday: boolean;
  active: boolean;
  sortOrder: number;
  lastSpawnYmd: string;
  /** YYYY-MM-DD em que esta ocorrência foi dada como feita. Vazio = por fazer. */
  doneYmd: string;
  area: TaskArea;
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

export function normalizeYmd(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function normalizeStartsAt(raw: unknown): string {
  const s = String(raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Manhã até às 12, tarde até às 18, depois noite. */
export function blockFromTime(time: string): TaskDayBlock {
  const startsAt = normalizeStartsAt(time);
  if (!startsAt) return "";
  const h = Number(startsAt.slice(0, 2));
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
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
  startsAt?: string;
  timeboxMin?: number;
  dayBlock?: TaskDayBlock;
  focusToday?: boolean;
  active?: boolean;
  sortOrder?: number;
  area?: TaskArea;
}): Routine {
  return {
    id: uid(),
    entityId: draft.entityId,
    title: draft.title.trim(),
    note: (draft.note ?? "").trim(),
    weekday: draft.weekday,
    startsAt: normalizeStartsAt(draft.startsAt),
    timeboxMin: normalizeTimebox(draft.timeboxMin ?? 0),
    dayBlock: draft.dayBlock ?? "",
    focusToday: Boolean(draft.focusToday),
    active: draft.active === undefined ? true : Boolean(draft.active),
    sortOrder: draft.sortOrder ?? 0,
    lastSpawnYmd: "",
    doneYmd: "",
    area: normalizeArea(draft.area),
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
    startsAt: normalizeStartsAt(r.startsAt ?? r.starts_at),
    timeboxMin: normalizeTimebox(r.timeboxMin ?? r.timebox_min),
    dayBlock: normalizeDayBlock(r.dayBlock ?? r.day_block),
    focusToday: Boolean(r.focusToday ?? r.focus_today),
    active: r.active === undefined ? true : Boolean(r.active),
    sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0) || 0,
    lastSpawnYmd: String(r.lastSpawnYmd ?? r.last_spawn_ymd ?? ""),
    doneYmd: normalizeYmd(r.doneYmd ?? r.done_ymd),
    area: normalizeArea(r.area),
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

/** Todas as rotinas do dia (activas + pausadas) — para a grelha da UI. */
export function routinesOfWeekday(routines: Routine[], weekday: Weekday): Routine[] {
  return routines
    .filter((r) => r.weekday === weekday)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export type RoutinePhase = "feito" | "agora" | "passou" | "a-seguir" | "sem-hora";

/** Onde está esta rotina face ao relógio de hoje. `agora` dura o timebox, ou 15 min. */
export function routinePhase(r: Routine, now: Date, ymd: string): RoutinePhase {
  if (r.doneYmd === ymd) return "feito";
  const clock = normalizeStartsAt(r.startsAt);
  if (!clock) return "sem-hora";
  const [hh, mm] = clock.split(":").map(Number);
  const startMin = hh * 60 + mm;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const span = Math.max(r.timeboxMin || 0, 15);
  if (nowMin < startMin) return "a-seguir";
  if (nowMin < startMin + span) return "agora";
  return "passou";
}

export function routinesInBlock(routines: Routine[], weekday: Weekday, dayBlock: TaskDayBlock): Routine[] {
  return routinesOfWeekday(routines, weekday).filter((r) => r.dayBlock === dayBlock);
}

/**
 * Move uma rotina para um dia e bloco, na posição `index` (0 = primeira).
 * Reescreve a ordem do bloco de destino. Devolve a mesma lista se nada mudou.
 */
export function placeRoutine(
  routines: Routine[],
  id: string,
  target: { weekday: Weekday; dayBlock: TaskDayBlock; index: number },
): Routine[] | null {
  const moving = routines.find((r) => r.id === id);
  if (!moving) return null;

  const dest = routines
    .filter((r) => r.id !== id && r.weekday === target.weekday && r.dayBlock === target.dayBlock)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pt"));
  const index = Math.max(0, Math.min(target.index, dest.length));
  const ordered = [...dest.slice(0, index), moving, ...dest.slice(index)];
  const sortOf = new Map(ordered.map((r, i) => [r.id, i]));

  let changed = false;
  const next = routines.map((r) => {
    const sortOrder = sortOf.get(r.id);
    if (sortOrder === undefined) return r;
    const weekday = r.id === id ? target.weekday : r.weekday;
    const dayBlock = r.id === id ? target.dayBlock : r.dayBlock;
    if (r.weekday === weekday && r.dayBlock === dayBlock && r.sortOrder === sortOrder) return r;
    changed = true;
    return touchRoutine({ ...r, weekday, dayBlock, sortOrder });
  });
  return changed ? next : routines;
}
