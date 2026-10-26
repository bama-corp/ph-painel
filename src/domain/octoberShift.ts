import type { Task, TaskSubtask } from "./tasks";

/** Conjunto de execução depois de Outubro ter passado. */
export const JS_NOVEMBER_BUNDLE = "js-novembro-2026";

type ShiftInput = {
  id: string;
  title: string;
  note: string;
  due: string;
  bundle: string;
  area: string;
  subtasks: TaskSubtask[];
  updatedAt?: string;
};

export function isJsTechTask(task: { id: string; bundle: string }): boolean {
  return (
    task.bundle === "js-outubro-2026" ||
    task.bundle === JS_NOVEMBER_BUNDLE ||
    task.id.startsWith("seed-js-2026-")
  );
}

/** Outubro → Novembro. O dia 31 cabe em 30 de Novembro. */
export function novemberDue(octoberYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(octoberYmd);
  if (!m) return octoberYmd;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year !== 2026 || month !== 10) return octoberYmd;
  const shifted = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return shifted > "2026-11-30" ? "2026-11-30" : shifted;
}

export function rewriteOctoberCopy(text: string, due: string): string {
  const day = Number(due.slice(8, 10));
  const withDay = Number.isFinite(day)
    ? text.replace(/^\d+\s+OUT\b/, `${day} NOV`)
    : text;
  return withDay
    .replace(/\bOUT\b/g, "NOV")
    .replace(/\bOutubro\b/g, "Novembro")
    .replace(/\bpara Novembro\b/g, "para Dezembro")
    .replace(/\/ Novembro\b/g, "/ Dezembro");
}

function sameSubtasks(a: TaskSubtask[], b: TaskSubtask[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s === b[i]);
}

/** Move o plano JS de Outubro para Novembro. Devolve o mesmo objecto se nada mudou. */
export function shiftOctoberTechTask<T extends ShiftInput>(task: T): T {
  if (!isJsTechTask(task)) return task;

  const due = task.due.startsWith("2026-10-") ? novemberDue(task.due) : task.due;
  const title = rewriteOctoberCopy(task.title, due);
  const note = rewriteOctoberCopy(task.note, due);
  const subtasks = task.subtasks.map((s) => {
    const nextTitle = rewriteOctoberCopy(s.title, due);
    return nextTitle === s.title ? s : { ...s, title: nextTitle };
  });
  const area = task.area || "tecnologia";
  const bundle = JS_NOVEMBER_BUNDLE;
  const subtasksSame = sameSubtasks(subtasks, task.subtasks);
  if (
    due === task.due &&
    title === task.title &&
    note === task.note &&
    bundle === task.bundle &&
    area === task.area &&
    subtasksSame
  ) {
    return task;
  }

  const next = {
    ...task,
    due,
    title,
    note,
    subtasks: subtasksSame ? task.subtasks : subtasks,
    bundle,
    area,
  };
  if (typeof task.updatedAt === "string") {
    return { ...next, updatedAt: new Date().toISOString() };
  }
  return next;
}

export function shiftOctoberTechTasks(tasks: Task[]): { tasks: Task[]; changedIds: string[] } {
  const changedIds: string[] = [];
  const next = tasks.map((task) => {
    const shifted = shiftOctoberTechTask(task);
    if (shifted !== task) changedIds.push(task.id);
    return shifted;
  });
  return { tasks: changedIds.length ? next : tasks, changedIds };
}
