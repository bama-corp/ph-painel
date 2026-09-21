import type { EntityId } from "./types";
import {
  focusTodayCount,
  impactScore,
  isTwoMinCandidate,
  MAX_FOCUS_TODAY,
  openCount,
  rankByImpact,
  tasksOf,
  type Task,
} from "./tasks";

export type TasksVista = "revisao" | "dia" | "matriz" | "kanban";

export type DueUrgency = "overdue" | "today" | "soon" | "later" | "none";

export function dueUrgency(due: string, today = todayYmd()): DueUrgency {
  if (!due) return "none";
  if (due < today) return "overdue";
  if (due === today) return "today";
  const t = parseYmd(today);
  const d = parseYmd(due);
  if (!t || !d) return "later";
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff <= 3) return "soon";
  return "later";
}

export function dueUrgencyLabel(u: DueUrgency): string {
  if (u === "overdue") return "Atrasado";
  if (u === "today") return "Hoje";
  if (u === "soon") return "Em breve";
  if (u === "later") return "Prazo";
  return "";
}

export function dueUrgencyClass(u: DueUrgency): string {
  if (u === "overdue") return "text-rust";
  if (u === "today") return "text-pine";
  if (u === "soon") return "text-copper";
  return "text-ink/35";
}

export function todayYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Segunda → domingo da semana ISO-ish (seg=0). */
export function weekRangeYmd(d = new Date()): { start: string; end: string } {
  const day = d.getDay(); // 0 dom … 6 sáb
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: todayYmd(start), end: todayYmd(end) };
}

export function isOpenTask(t: Task) {
  return t.status !== "feita";
}

export function tasksInbox(tasks: Task[], entityId: EntityId) {
  return tasksOf(tasks, entityId).filter((t) => t.status === "inbox");
}

export function tasksFocusToday(tasks: Task[], entityId: EntityId) {
  return tasksOf(tasks, entityId).filter((t) => t.focusToday && isOpenTask(t));
}

export function tasksDueInWeek(tasks: Task[], entityId: EntityId, d = new Date()) {
  const { start, end } = weekRangeYmd(d);
  return tasksOf(tasks, entityId)
    .filter((t) => isOpenTask(t) && t.due && t.due >= start && t.due <= end)
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function tasksOverdue(tasks: Task[], entityId: EntityId, d = new Date()) {
  const today = todayYmd(d);
  return tasksOf(tasks, entityId)
    .filter((t) => isOpenTask(t) && t.due && t.due < today)
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Feitas cujo updatedAt (ou at) cai no dia. */
export function tasksDoneOn(tasks: Task[], entityId: EntityId, ymd: string) {
  return tasksOf(tasks, entityId).filter((t) => {
    if (t.status !== "feita") return false;
    const day = (t.updatedAt || "").slice(0, 10) || t.at;
    return day === ymd;
  });
}

export type WeeklyCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
};

export type ReviewSnapshot = {
  today: string;
  weekStart: string;
  weekEnd: string;
  inbox: Task[];
  /** Inbox candidata a ≤2 min */
  twoMin: Task[];
  /** Resto da inbox (precisa esclarecer) */
  inboxRest: Task[];
  focus: Task[];
  /** Abertas sem «Hoje», ordenadas por impacto (sugestões 80/20) */
  impactCandidates: Task[];
  overdue: Task[];
  dueWeek: Task[];
  doneToday: Task[];
  openN: number;
  focusN: number;
  focusSlotsLeft: number;
  /** Passos do ritual: capturar inbox → escolher Hoje → olhar semana → fechar o dia */
  steps: {
    id: "inbox" | "hoje" | "semana" | "fecho";
    label: string;
    ok: boolean;
    hint: string;
  }[];
  /** Checklist GTD semanal */
  weekly: WeeklyCheckItem[];
};

export function buildReviewSnapshot(tasks: Task[], entityId: EntityId, d = new Date()): ReviewSnapshot {
  const today = todayYmd(d);
  const { start, end } = weekRangeYmd(d);
  const inbox = tasksInbox(tasks, entityId);
  const twoMin = inbox.filter(isTwoMinCandidate);
  const twoMinIds = new Set(twoMin.map((t) => t.id));
  const inboxRest = inbox.filter((t) => !twoMinIds.has(t.id));
  const focus = rankByImpact(tasksFocusToday(tasks, entityId), today);
  const overdue = tasksOverdue(tasks, entityId, d);
  const dueWeek = tasksDueInWeek(tasks, entityId, d);
  const doneToday = tasksDoneOn(tasks, entityId, today);
  const focusN = focusTodayCount(tasks, entityId);
  const openN = openCount(tasks, entityId);
  const impactCandidates = rankByImpact(
    tasksOf(tasks, entityId).filter(
      (t) => isOpenTask(t) && !t.focusToday && t.status !== "inbox",
    ),
    today,
  ).slice(0, 5);

  const steps: ReviewSnapshot["steps"] = [
    {
      id: "inbox",
      label: "Esclarecer caixa de entrada",
      ok: inbox.length === 0,
      hint:
        inbox.length === 0
          ? "Inbox limpa."
          : twoMin.length > 0
            ? `${twoMin.length} ≤2 min · ${inboxRest.length} por esclarecer.`
            : `${inbox.length} por esclarecer (status + Eisenhower).`,
    },
    {
      id: "hoje",
      label: "Escolher até 3 «Hoje» (80/20)",
      ok: focusN > 0 && focusN <= MAX_FOCUS_TODAY,
      hint:
        focusN === 0
          ? "Marca 1–3 pelo impacto (Eisenhower + prazo)."
          : focusN > MAX_FOCUS_TODAY
            ? `Acima do limite (${focusN}/${MAX_FOCUS_TODAY}).`
            : `${focusN}/${MAX_FOCUS_TODAY} · ordenadas por impacto.`,
    },
    {
      id: "semana",
      label: "Olhar prazos da semana",
      ok: overdue.length === 0,
      hint:
        overdue.length > 0
          ? `${overdue.length} em atraso — trata ou reagenda.`
          : dueWeek.length > 0
            ? `${dueWeek.length} com prazo esta semana.`
            : "Sem prazos esta semana.",
    },
    {
      id: "fecho",
      label: "Fecho do dia",
      ok: doneToday.length > 0 || (inbox.length === 0 && focusN > 0),
      hint:
        doneToday.length > 0
          ? `${doneToday.length} concluída(s) hoje.`
          : "Move o que terminaste para Feita.",
    },
  ];

  const stuck = tasksOf(tasks, entityId).filter(
    (t) => isOpenTask(t) && (t.status === "executar" || t.status === "ajustar"),
  );
  const noDue = tasksOf(tasks, entityId).filter(
    (t) => isOpenTask(t) && t.status !== "inbox" && !t.due,
  );

  const weekly: WeeklyCheckItem[] = [
    {
      id: "inbox-clear",
      label: "Inbox a zero",
      ok: inbox.length === 0,
      hint: inbox.length === 0 ? "Limpa." : `${inbox.length} ainda na caixa.`,
    },
    {
      id: "overdue",
      label: "Sem atrasos",
      ok: overdue.length === 0,
      hint: overdue.length === 0 ? "Em dia." : `${overdue.length} em atraso.`,
    },
    {
      id: "stuck",
      label: "Desbloquear Executar / Ajustar",
      ok: stuck.length <= 3,
      hint:
        stuck.length === 0
          ? "Nada preso."
          : `${stuck.length} em Executar/Ajustar — avança ou devolve.`,
    },
    {
      id: "calendar",
      label: "Prazos da semana cobertos",
      ok: dueWeek.length === 0 || dueWeek.every((t) => t.quadrant || t.focusToday),
      hint:
        dueWeek.length === 0
          ? "Sem prazos esta semana."
          : `${dueWeek.length} com prazo — confirma Eisenhower ou «Hoje».`,
    },
    {
      id: "someday",
      label: "Rever abertas sem prazo",
      ok: noDue.length <= 5,
      hint:
        noDue.length === 0
          ? "Todas com prazo ou inbox."
          : `${noDue.length} sem prazo — elimina, delega ou agenda.`,
    },
  ];

  return {
    today,
    weekStart: start,
    weekEnd: end,
    inbox,
    twoMin,
    inboxRest,
    focus,
    impactCandidates,
    overdue,
    dueWeek,
    doneToday,
    openN,
    focusN,
    focusSlotsLeft: Math.max(0, MAX_FOCUS_TODAY - focusN),
    steps,
    weekly,
  };
}

export function formatWeekLabel(start: string, end: string): string {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (!a || !b) return `${start} – ${end}`;
  const fmt = (x: Date) =>
    x.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)}`;
}

const REVIEW_DONE_KEY = "ph-tarefas-review-done-v1";
const WEEKLY_DONE_KEY = "ph-tarefas-weekly-done-v1";

export function isReviewMarkedDone(entityId: EntityId, ymd: string): boolean {
  try {
    const raw = localStorage.getItem(REVIEW_DONE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[entityId] === ymd;
  } catch {
    return false;
  }
}

export function markReviewDone(entityId: EntityId, ymd: string) {
  try {
    const raw = localStorage.getItem(REVIEW_DONE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    map[entityId] = ymd;
    localStorage.setItem(REVIEW_DONE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearReviewDone(entityId: EntityId) {
  try {
    const raw = localStorage.getItem(REVIEW_DONE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    delete map[entityId];
    localStorage.setItem(REVIEW_DONE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Marca revisão semanal (chave = início da semana). */
export function isWeeklyReviewDone(entityId: EntityId, weekStart: string): boolean {
  try {
    const raw = localStorage.getItem(WEEKLY_DONE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[entityId] === weekStart;
  } catch {
    return false;
  }
}

export function markWeeklyReviewDone(entityId: EntityId, weekStart: string) {
  try {
    const raw = localStorage.getItem(WEEKLY_DONE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    map[entityId] = weekStart;
    localStorage.setItem(WEEKLY_DONE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearWeeklyReviewDone(entityId: EntityId) {
  try {
    const raw = localStorage.getItem(WEEKLY_DONE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    delete map[entityId];
    localStorage.setItem(WEEKLY_DONE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export { impactScore, isTwoMinCandidate, rankByImpact };
