import type { EntityId } from "./types";
import { COMPANIES } from "./types";
import { ENTITY } from "./labels";

/** Kanban do quadro + inbox GTD (fora do quadro até esclarecer) */
export type TaskStatus =
  | "inbox"
  | "para_fazer"
  | "planejar"
  | "executar"
  | "revisar"
  | "ajustar"
  | "feita";

/** Matriz de Eisenhower */
export type TaskQuadrant = "fazer" | "agendar" | "delegar" | "eliminar" | "";

/** Bloco do dia (time blocking leve) */
export type TaskDayBlock = "" | "manha" | "tarde" | "noite";

export type Task = {
  id: string;
  entityId: EntityId;
  title: string;
  note: string;
  status: TaskStatus;
  quadrant: TaskQuadrant;
  /** Uma das ≤3 prioridades do dia */
  focusToday: boolean;
  at: string;
  due: string;
  /** Duração máxima em minutos (timeboxing). 0 = sem limite. */
  timeboxMin: number;
  /** Reserva no dia: manhã / tarde / noite */
  dayBlock: TaskDayBlock;
  /** Origem: id da rotina semanal (vazio se ad-hoc) */
  routineId: string;
  /** ISO — merge local↔remoto */
  updatedAt: string;
};

export const TASKS_STORAGE_KEY = "ph-tarefas-v2";
const LEGACY_KEY = "ph-tarefas-v1";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: "Caixa de entrada",
  para_fazer: "Para fazer",
  planejar: "Planejar",
  executar: "Executar",
  revisar: "Revisar",
  ajustar: "Ajustar",
  feita: "Feito",
};

/** Colunas do quadro Kanban (inbox fica só na Revisão / captura). */
export const KANBAN_COLUMNS: Exclude<TaskStatus, "inbox">[] = [
  "para_fazer",
  "planejar",
  "executar",
  "revisar",
  "ajustar",
  "feita",
];

export const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  inbox: "para_fazer",
  para_fazer: "planejar",
  planejar: "executar",
  executar: "revisar",
  revisar: "ajustar",
  ajustar: "feita",
};

export const QUADRANT_LABEL: Record<Exclude<TaskQuadrant, "">, string> = {
  fazer: "Fazer agora",
  agendar: "Agendar",
  delegar: "Delegar",
  eliminar: "Eliminar",
};

export const DAY_BLOCK_LABEL: Record<Exclude<TaskDayBlock, "">, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const TIMEBOX_PRESETS = [0, 2, 15, 25, 45, 60, 90] as const;

function normalizeDayBlock(raw: unknown): TaskDayBlock {
  if (raw === "manha" || raw === "tarde" || raw === "noite") return raw;
  return "";
}

function normalizeTimebox(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(480, Math.round(n));
}

export const TASK_NAV: { entityId: EntityId; to: string; label: string }[] = [
  { entityId: "pessoal", to: "/tarefas", label: "Minhas" },
  ...COMPANIES.map((id) => ({
    entityId: id,
    to: `/tarefas/${ENTITY[id].path.replace(/^\//, "")}`,
    label: ENTITY[id].short,
  })),
];

export const TASK_SYSTEM_NAV = { to: "/tarefas/sistema", label: "Sistema" } as const;
export const TASK_CALENDAR_NAV = { to: "/tarefas/calendario", label: "Calendário" } as const;
export const TASK_ALERTS_NAV = { to: "/tarefas/alertas", label: "Alertas" } as const;
export const TASK_ROUTINE_NAV = { to: "/tarefas/rotina", label: "Rotina" } as const;

/** path segment → entityId (minhas = pessoal) */
export function entityFromTasksPath(segment: string | undefined): EntityId {
  if (!segment || segment === "minhas") return "pessoal";
  const hit = COMPANIES.find((id) => ENTITY[id].path === `/${segment}`);
  return hit ?? "pessoal";
}

export function tasksPathFor(entityId: EntityId): string {
  if (entityId === "pessoal") return "/tarefas";
  return `/tarefas${ENTITY[entityId].path}`;
}

function uid() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeStatus(raw: unknown): TaskStatus {
  if (raw === "aberta" || raw === "a_fazer") return "para_fazer";
  if (raw === "em_curso") return "executar";
  if (
    raw === "inbox" ||
    raw === "para_fazer" ||
    raw === "planejar" ||
    raw === "executar" ||
    raw === "revisar" ||
    raw === "ajustar" ||
    raw === "feita"
  ) {
    return raw;
  }
  return "para_fazer";
}

function normalizeQuadrant(raw: unknown): TaskQuadrant {
  if (raw === "fazer" || raw === "agendar" || raw === "delegar" || raw === "eliminar") return raw;
  return "";
}

export function nowIso() {
  return new Date().toISOString();
}

export function touchTask(task: Task): Task {
  return { ...task, updatedAt: nowIso() };
}

export function createTask(
  draft: {
    entityId: EntityId;
    title: string;
    note?: string;
    due?: string;
    status?: TaskStatus;
    quadrant?: TaskQuadrant;
    focusToday?: boolean;
    timeboxMin?: number;
    dayBlock?: TaskDayBlock;
    routineId?: string;
  },
  at = new Date().toISOString().slice(0, 10),
): Task {
  return {
    id: uid(),
    entityId: draft.entityId,
    title: draft.title.trim(),
    note: (draft.note ?? "").trim(),
    status: draft.status ?? "inbox",
    quadrant: draft.quadrant ?? "",
    focusToday: Boolean(draft.focusToday),
    at,
    due: (draft.due ?? "").trim(),
    timeboxMin: normalizeTimebox(draft.timeboxMin ?? 0),
    dayBlock: draft.dayBlock ?? "",
    routineId: (draft.routineId ?? "").trim(),
    updatedAt: nowIso(),
  };
}

export function coerceTask(x: unknown): Task | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.entityId !== "string" || typeof t.title !== "string") {
    return null;
  }
  const at = typeof t.at === "string" ? t.at : new Date().toISOString().slice(0, 10);
  const updatedAt =
    typeof t.updatedAt === "string" && t.updatedAt
      ? t.updatedAt
      : `${at}T00:00:00.000Z`;
  return {
    id: t.id,
    entityId: t.entityId as EntityId,
    title: t.title,
    note: typeof t.note === "string" ? t.note : "",
    status: normalizeStatus(t.status),
    quadrant: normalizeQuadrant(t.quadrant),
    focusToday: Boolean(t.focusToday),
    at,
    due: typeof t.due === "string" ? t.due : "",
    timeboxMin: normalizeTimebox(t.timeboxMin ?? t.timebox_min),
    dayBlock: normalizeDayBlock(t.dayBlock ?? t.day_block),
    routineId: typeof t.routineId === "string" ? t.routineId : typeof t.routine_id === "string" ? t.routine_id : "",
    updatedAt,
  };
}

/** Merge por id: local ganha se updatedAt for mais recente; respeita deletes pendentes. */
export function mergeTasks(
  local: Task[],
  remote: Task[],
  pendingDeleteIds: ReadonlySet<string> = new Set(),
): Task[] {
  const map = new Map<string, Task>();
  for (const t of remote) {
    if (pendingDeleteIds.has(t.id)) continue;
    map.set(t.id, t);
  }
  for (const t of local) {
    if (pendingDeleteIds.has(t.id)) continue;
    const existing = map.get(t.id);
    if (!existing) {
      map.set(t.id, t);
      continue;
    }
    const lu = t.updatedAt || "";
    const ru = existing.updatedAt || "";
    if (lu > ru) map.set(t.id, t);
  }
  return Array.from(map.values());
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceTask).filter((t): t is Task => t !== null);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function tasksOf(tasks: Task[], entityId: EntityId) {
  return tasks.filter((t) => t.entityId === entityId);
}

/** Contagem «ainda aberta» (inbox + a fazer + em curso). */
export function openCount(tasks: Task[], entityId: EntityId) {
  return tasksOf(tasks, entityId).filter((t) => t.status !== "feita").length;
}

export function focusTodayCount(tasks: Task[], entityId: EntityId) {
  return tasksOf(tasks, entityId).filter((t) => t.focusToday && t.status !== "feita").length;
}

export const MAX_FOCUS_TODAY = 3;

/** Limite WIP na coluna Executar (Kanban). */
export const WIP_EXECUTAR_LIMIT = 3;

export function executarWipCount(tasks: Task[], entityId: EntityId) {
  return tasksOf(tasks, entityId).filter((t) => t.status === "executar").length;
}

/**
 * Score 80/20: Eisenhower + prazo. Maior = mais impacto no dia.
 * Sem campo extra na BD — ranking derivado.
 */
export function impactScore(t: Task, today = new Date().toISOString().slice(0, 10)): number {
  let score = 0;
  if (t.quadrant === "fazer") score += 40;
  else if (t.quadrant === "agendar") score += 25;
  else if (t.quadrant === "delegar") score += 12;
  else if (t.quadrant === "eliminar") score += 0;
  else score += 8;
  if (t.due) {
    if (t.due < today) score += 20;
    else if (t.due === today) score += 14;
    else {
      const diff = Math.round(
        (new Date(`${t.due}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) /
          86400000,
      );
      if (diff <= 3) score += 8;
    }
  }
  if (t.focusToday) score += 5;
  return score;
}

export function rankByImpact(tasks: Task[], today?: string): Task[] {
  const day = today ?? new Date().toISOString().slice(0, 10);
  return [...tasks].sort((a, b) => {
    const d = impactScore(b, day) - impactScore(a, day);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "pt");
  });
}

export function impactTier(score: number): "alto" | "medio" | "baixo" {
  if (score >= 45) return "alto";
  if (score >= 28) return "medio";
  return "baixo";
}

export const IMPACT_TIER_LABEL = {
  alto: "Impacto alto",
  medio: "Impacto médio",
  baixo: "Impacto baixo",
} as const;

/** Candidato óbvio à regra dos 2 min (inbox). */
export function isTwoMinCandidate(t: Task): boolean {
  if (t.status !== "inbox") return false;
  if (t.timeboxMin === 2) return true;
  return !t.quadrant && t.timeboxMin <= 2;
}

export function isMockTaskId(id: string) {
  return id.startsWith("mock-");
}

const MOCK_VER_KEY = "ph-tarefas-mock-ver";

/** Remove tarefas demo (ids mock-*) e limpa a flag de seed no browser. */
export function stripMockTasks(tasks: Task[]): { tasks: Task[]; removedIds: string[] } {
  try {
    localStorage.removeItem(MOCK_VER_KEY);
  } catch {
    /* ignore */
  }
  const removedIds: string[] = [];
  const next: Task[] = [];
  for (const t of tasks) {
    if (isMockTaskId(t.id)) removedIds.push(t.id);
    else next.push(t);
  }
  return { tasks: next, removedIds };
}
