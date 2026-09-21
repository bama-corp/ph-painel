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

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Demo: cobre inbox GTD, Eisenhower, Kanban e «Hoje» em vários âmbitos. */
export function buildMockTasks(): Task[] {
  const at = new Date().toISOString().slice(0, 10);
  const stamp = nowIso();
  const due = (days: number) => isoDaysFromNow(days);

  const row = (
    id: string,
    entityId: EntityId,
    title: string,
    patch: Partial<
      Pick<Task, "note" | "status" | "quadrant" | "focusToday" | "due" | "timeboxMin" | "dayBlock">
    >,
  ): Task => ({
    id,
    entityId,
    title,
    note: patch.note ?? "",
    status: patch.status ?? "inbox",
    quadrant: patch.quadrant ?? "",
    focusToday: Boolean(patch.focusToday),
    at,
    due: patch.due ?? "",
    timeboxMin: patch.timeboxMin ?? 0,
    dayBlock: patch.dayBlock ?? "",
    updatedAt: stamp,
  });

  return [
    // —— Minhas: GTD inbox (fora do quadro) ——
    row("mock-p-inbox-1", "pessoal", "Ligar ao BAI sobre extrato", {
      status: "inbox",
      note: "Captura — se ≤2 min, faz já na Revisão.",
      timeboxMin: 2,
    }),
    row("mock-p-inbox-2", "pessoal", "Ideia: rever seguro do carro", {
      status: "inbox",
    }),

    // —— Quadro: Para fazer ——
    row("mock-p-pf-1", "pessoal", "Enviar comprovativo ao contabilista", {
      status: "para_fazer",
      quadrant: "fazer",
      focusToday: true,
      due: due(0),
      timeboxMin: 25,
      dayBlock: "manha",
    }),
    row("mock-p-pf-2", "pessoal", "Agendar check-up dentista", {
      status: "para_fazer",
      quadrant: "agendar",
      due: due(14),
      timeboxMin: 15,
      dayBlock: "tarde",
    }),
    row("mock-p-pf-3", "pessoal", "Pedir à Ana o PDF do contrato", {
      status: "para_fazer",
      quadrant: "delegar",
      timeboxMin: 2,
    }),
    row("mock-p-pf-4", "pessoal", "Cancelar newsletter inútil", {
      status: "para_fazer",
      quadrant: "eliminar",
      timeboxMin: 2,
    }),
    row("mock-p-pf-5", "pessoal", "Renovar carta de condução", {
      status: "para_fazer",
      quadrant: "agendar",
      due: due(30),
      dayBlock: "tarde",
    }),
    row("mock-p-pf-6", "pessoal", "Comprar filtro de água", {
      status: "para_fazer",
      quadrant: "fazer",
      timeboxMin: 45,
      dayBlock: "noite",
    }),

    // —— Planejar ——
    row("mock-p-pl-1", "pessoal", "Marcar revisão semanal", {
      status: "planejar",
      quadrant: "agendar",
      focusToday: true,
      due: due(2),
      timeboxMin: 60,
      dayBlock: "manha",
    }),
    row("mock-p-pl-2", "pessoal", "Definir orçamento lazer Q4", {
      status: "planejar",
      quadrant: "fazer",
      timeboxMin: 90,
      dayBlock: "tarde",
    }),

    // —— Executar ——
    row("mock-p-ex-1", "pessoal", "Bloquear 90 min para o painel PH", {
      status: "executar",
      quadrant: "fazer",
      focusToday: true,
      note: "Timebox 90′.",
      timeboxMin: 90,
      dayBlock: "manha",
    }),
    row("mock-p-ex-2", "pessoal", "Responder email do banco", {
      status: "executar",
      quadrant: "fazer",
      timeboxMin: 15,
    }),
    row("mock-p-ex-3", "pessoal", "Actualizar CV / LinkedIn", {
      status: "executar",
      quadrant: "agendar",
      timeboxMin: 45,
      dayBlock: "noite",
    }),

    // —— Revisar ——
    row("mock-p-rv-1", "pessoal", "Rever proposta do seguro", {
      status: "revisar",
      quadrant: "agendar",
    }),

    // —— Ajustar ——
    row("mock-p-aj-1", "pessoal", "Corrigir extrato importado", {
      status: "ajustar",
      quadrant: "fazer",
    }),

    // —— Feito ——
    row("mock-p-feita", "pessoal", "Pagar água / luz", {
      status: "feita",
      quadrant: "fazer",
      due: due(-2),
    }),

    // —— Empresas (espalhadas no quadro) ——
    row("mock-cw-1", "cw", "Fechar mês PDS", {
      status: "executar",
      quadrant: "fazer",
      focusToday: true,
      due: due(3),
    }),
    row("mock-cw-2", "cw", "Follow-up proposta cliente X", {
      status: "para_fazer",
      quadrant: "fazer",
    }),
    row("mock-cw-3", "cw", "Inbox: nota de reunião", {
      status: "inbox",
    }),
    row("mock-rove-1", "rove", "Actualizar pipeline", {
      status: "planejar",
      quadrant: "agendar",
      due: due(7),
    }),
    row("mock-rove-2", "rove", "Enviar proposta Rove", {
      status: "para_fazer",
      quadrant: "fazer",
    }),
    row("mock-picasso-1", "picasso", "Confirmar stock", {
      status: "executar",
      quadrant: "fazer",
      focusToday: true,
    }),
    row("mock-picasso-2", "picasso", "Rever preços de carta", {
      status: "revisar",
      quadrant: "agendar",
    }),
    row("mock-ph-1", "ph", "Rever regras do Assistente", {
      status: "planejar",
      quadrant: "agendar",
    }),
    row("mock-ph-2", "ph", "Deploy checklist TASKS_URL", {
      status: "feita",
      quadrant: "fazer",
    }),
    row("mock-ph-3", "ph", "Ajustar copy do Hub", {
      status: "ajustar",
      quadrant: "fazer",
    }),
  ];
}

/** Garante o pacote demo (ids mock-*). Não apaga tarefas reais. */
const MOCK_VER_KEY = "ph-tarefas-mock-ver";
const MOCK_VER = "methods-2min-box";

export function ensureSeededTasks(tasks: Task[]): { tasks: Task[]; addedIds: string[] } {
  try {
    if (localStorage.getItem(MOCK_VER_KEY) !== MOCK_VER) {
      const real = tasks.filter((t) => !t.id.startsWith("mock-"));
      const mocks = buildMockTasks();
      localStorage.setItem(MOCK_VER_KEY, MOCK_VER);
      return { tasks: [...mocks, ...real], addedIds: mocks.map((t) => t.id) };
    }
  } catch {
    /* ignore */
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const addedIds: string[] = [];
  for (const m of buildMockTasks()) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
      addedIds.push(m.id);
    }
  }
  if (addedIds.length === 0) return { tasks, addedIds };
  return { tasks: Array.from(byId.values()), addedIds };
}
