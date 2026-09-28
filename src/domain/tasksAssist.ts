/**
 * Assistente de Tarefas — interpreta frases em PT e propõe acções.
 * Não aplica sozinho: a UI confirma antes de gravar.
 */
import type { EntityId } from "./types";
import {
  createSubtask,
  type Task,
  type TaskStatus,
} from "./tasks";

export type TasksAssistDraft = {
  entityId: EntityId;
  title: string;
  note?: string;
  due?: string;
  status?: TaskStatus;
  focusToday?: boolean;
};

export type TasksAssistAction =
  | { type: "add"; draft: TasksAssistDraft }
  | { type: "setStatus"; id: string; status: TaskStatus; title: string }
  | { type: "toggleFocus"; id: string; title: string }
  | { type: "setDue"; id: string; due: string; title: string }
  | { type: "addSubtask"; id: string; subtaskTitle: string; parentTitle: string }
  | { type: "unknown"; reason: string };

export type TasksAssistProposal = {
  id: string;
  summary: string;
  detail: string;
  confidence: "high" | "medium" | "low";
  action: TasksAssistAction;
};

export type TasksClarifyOption = {
  label: string;
  proposal: TasksAssistProposal;
};

export type TasksChatTurn =
  | { type: "info"; text: string }
  | { type: "fresh"; proposal: TasksAssistProposal }
  | { type: "clarify"; text: string; options: TasksClarifyOption[] }
  | { type: "confirm" }
  | { type: "skip" }
  | { type: "unknown"; text: string };

const ENTITY_SHORT: Record<EntityId, string> = {
  pessoal: "Minhas",
  cw: "PDS",
  rove: "Plural",
  picasso: "Picasso's",
  ph: "PH",
};

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function uid() {
  return `ta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function todayYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowYmd(d = new Date()) {
  const t = new Date(d);
  t.setDate(t.getDate() + 1);
  return todayYmd(t);
}

function entityLabel(id: EntityId) {
  return ENTITY_SHORT[id] ?? id;
}

function detectEntity(text: string, hint?: EntityId): EntityId {
  const f = fold(text);
  if (/\b(pds|padstation|cyber)\b/.test(f)) return "cw";
  if (/\b(plural|rove|iptv|netflix)\b/.test(f)) return "rove";
  if (/\b(picasso'?s?|picasso)\b/.test(f)) return "picasso";
  if (/\bph\b/.test(f) && !/\bph tarefas\b/.test(f)) return "ph";
  if (/\b(minhas|pessoal|eu|mim)\b/.test(f)) return "pessoal";
  return hint ?? "pessoal";
}

function stripEntityWords(text: string) {
  return text
    .replace(
      /\b(na|no|da|do|em|para)?\s*(pds|padstation|cyber|plural|rove|picasso'?s?|picasso|ph|minhas|pessoal)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseDueToken(text: string): string | null {
  const f = fold(text);
  if (/\bhoje\b/.test(f)) return todayYmd();
  if (/\bamanha\b/.test(f)) return tomorrowYmd();
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](20\d{2}))?\b/);
  if (br) {
    const d = String(br[1]).padStart(2, "0");
    const m = String(br[2]).padStart(2, "0");
    const y = br[3] || String(new Date().getFullYear());
    return `${y}-${m}-${d}`;
  }
  return null;
}

function openTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status !== "feita");
}

function matchTasks(tasks: Task[], query: string, entity?: EntityId): Task[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const pool = entity ? tasks.filter((t) => t.entityId === entity) : tasks;
  const open = openTasks(pool);
  const hits = open.filter((t) => fold(t.title).includes(q));
  if (hits.length) return hits;
  // tokens: all words must appear
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length >= 2) {
    return open.filter((t) => {
      const title = fold(t.title);
      return words.every((w) => title.includes(w));
    });
  }
  return [];
}

function listLines(tasks: Task[], limit = 8) {
  const slice = tasks.slice(0, limit);
  const lines = slice.map((t) => `· ${t.title} — ${entityLabel(t.entityId)}`);
  if (tasks.length > limit) lines.push(`· … +${tasks.length - limit}`);
  return lines.join("\n");
}

function infoToday(tasks: Task[]) {
  const today = todayYmd();
  const open = openTasks(tasks);
  const focus = open.filter((t) => t.focusToday);
  const due = open.filter((t) => t.due === today);
  const overdue = open.filter((t) => t.due && t.due < today);

  const parts: string[] = [];
  parts.push(
    `${overdue.length} atrasada${overdue.length === 1 ? "" : "s"} · ${due.length} prazo · ${focus.length} foco`,
  );
  if (focus.length) {
    parts.push("", "HOJE · FOCO", listLines(focus, 5));
  }
  if (due.length) {
    parts.push("", "PRAZO HOJE", listLines(due, 8));
  }
  if (overdue.length) {
    parts.push("", "ATRASADAS", listLines(overdue, 8));
  }
  if (!focus.length && !due.length && !overdue.length) {
    parts.push("", "Nada marcado para hoje. Esclarece a inbox ou escolhe até 3 «Hoje».");
  }
  return parts.join("\n");
}

function infoOverdue(tasks: Task[]) {
  const today = todayYmd();
  const overdue = openTasks(tasks).filter((t) => t.due && t.due < today);
  if (!overdue.length) return "Sem tarefas atrasadas.";
  return `Atrasadas (${overdue.length})\n\n${listLines(overdue)}`;
}

function infoInbox(tasks: Task[]) {
  const inbox = tasks.filter((t) => t.status === "inbox");
  if (!inbox.length) return "Inbox limpa.";
  return `Inbox (${inbox.length}) por esclarecer\n\n${listLines(inbox)}`;
}

function infoOpen(tasks: Task[], entity?: EntityId) {
  const pool = entity ? tasks.filter((t) => t.entityId === entity) : tasks;
  const open = openTasks(pool);
  const label = entity ? entityLabel(entity) : "todas";
  if (!open.length) return `Nada aberto em ${label}.`;
  return `Abertas · ${label} (${open.length})\n\n${listLines(open)}`;
}

function proposal(
  partial: Omit<TasksAssistProposal, "id"> & { id?: string },
): TasksAssistProposal {
  return { id: partial.id ?? uid(), ...partial };
}

function extractAddTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(
    /^(adiciona|adiciona[r]?|cria|criar|nova|novo|mete|meter|captura)\s+(tarefa\s+)?/i,
    "",
  );
  t = t.replace(/^tarefa\s*[:=-]?\s*/i, "");
  t = t.replace(/^:\s*/, "");
  t = stripEntityWords(t);
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function extractAfterCue(text: string, cues: RegExp): string {
  const m = text.match(cues);
  if (!m || m.index === undefined) return "";
  return text.slice(m.index + m[0].length).trim();
}

/**
 * Resolve tarefa por query; se várias, devolve clarify.
 */
function resolveTaskTurn(
  query: string,
  tasks: Task[],
  entityHint: EntityId | undefined,
  build: (t: Task) => TasksAssistProposal,
): TasksChatTurn {
  const q = stripEntityWords(query).replace(/^(a|o|as|os)\s+/i, "").trim();
  if (q.length < 2) {
    return { type: "unknown", text: "Diz o nome (ou parte) da tarefa." };
  }
  const hits = matchTasks(tasks, q, undefined);
  if (!hits.length) {
    const scoped = entityHint ? matchTasks(tasks, q, entityHint) : [];
    if (!scoped.length) {
      return {
        type: "unknown",
        text: `Não encontrei tarefa aberta com «${q}». Diz outro pedaço do título.`,
      };
    }
    if (scoped.length === 1) {
      return { type: "fresh", proposal: build(scoped[0]!) };
    }
    return {
      type: "clarify",
      text: `Qual destas? («${q}»)`,
      options: scoped.slice(0, 4).map((t) => ({
        label: `${t.title} · ${entityLabel(t.entityId)}`,
        proposal: build(t),
      })),
    };
  }
  if (hits.length === 1) {
    return { type: "fresh", proposal: build(hits[0]!) };
  }
  return {
    type: "clarify",
    text: `Qual destas? («${q}»)`,
    options: hits.slice(0, 4).map((t) => ({
      label: `${t.title} · ${entityLabel(t.entityId)}`,
      proposal: build(t),
    })),
  };
}

export function tasksAssistActionLabel(a: TasksAssistAction): string {
  switch (a.type) {
    case "add":
      return "Nova tarefa";
    case "setStatus":
      return a.status === "feita" ? "Concluir" : "Estado";
    case "toggleFocus":
      return "Foco hoje";
    case "setDue":
      return "Prazo";
    case "addSubtask":
      return "Subtarefa";
    default:
      return "—";
  }
}

/**
 * Interpreta uma frase do chat de tarefas.
 */
export function interpretTasksChat(
  text: string,
  tasks: Task[],
  opts: { entityHint?: EntityId; pending?: TasksAssistProposal | null } = {},
): TasksChatTurn {
  const trimmed = text.trim();
  if (!trimmed) return { type: "unknown", text: "Escreve uma frase." };

  const f = fold(trimmed);
  const pending = opts.pending ?? null;

  if (pending && /^(sim|ok|confirma|confirmar|isso|pode|vai|faz|fazer)$/i.test(trimmed)) {
    return { type: "confirm" };
  }
  if (pending && /^(nao|não|cancela|cancelar|ignora|ignorar|descarta|passa)$/i.test(trimmed)) {
    return { type: "skip" };
  }

  // —— Info ——
  if (
    /\b(o que tenho|que tenho|resumo)\b/.test(f) ||
    /^(hoje|o dia)\??$/.test(f) ||
    /\bhoje\b/.test(f) && /\b(tarefas|tenho|foco|prazo)\b/.test(f)
  ) {
    return { type: "info", text: infoToday(tasks) };
  }
  if (/\batrasad/.test(f)) {
    return { type: "info", text: infoOverdue(tasks) };
  }
  if (/\binbox\b|\bcaixa de entrada\b|\bpor esclarecer\b/.test(f)) {
    return { type: "info", text: infoInbox(tasks) };
  }
  if (/\b(abertas?|pendentes?|quantas)\b/.test(f) && !/\badiciona|\bcria|\bnova\b/.test(f)) {
    const ent = detectEntity(trimmed, opts.entityHint);
    const hasEntityWord =
      /\b(pds|plural|picasso|ph|minhas|pessoal|cyber)\b/.test(f) ||
      opts.entityHint !== undefined;
    return {
      type: "info",
      text: infoOpen(tasks, hasEntityWord ? ent : undefined),
    };
  }

  // —— Criar ——
  if (
    /^(adiciona|adicionar|cria|criar|nova|novo|mete|meter|captura)\b/.test(f) ||
    /^tarefa\s*[:=-]/.test(f) ||
    /\bnova tarefa\b/.test(f)
  ) {
    const entity = detectEntity(trimmed, opts.entityHint);
    const title = extractAddTitle(trimmed);
    if (title.length < 2) {
      return {
        type: "unknown",
        text: "Diz o título — ex. «adiciona tarefa Arranjar TVs na PDS».",
      };
    }
    const due = parseDueToken(trimmed);
    return {
      type: "fresh",
      proposal: proposal({
        summary: `Criar «${title}»`,
        detail: `${entityLabel(entity)}${due ? ` · prazo ${due}` : ""} · entra na inbox`,
        confidence: "high",
        action: {
          type: "add",
          draft: {
            entityId: entity,
            title,
            due: due ?? undefined,
            status: "inbox",
          },
        },
      }),
    };
  }

  // —— Subtarefa ——
  if (/\bsubtarefa\b/.test(f)) {
    // «subtarefa WhatsApp em Redes Sociais» | «adiciona subtarefa X a Y»
    const m =
      trimmed.match(/\bsubtarefa\s+(.+?)\s+(?:em|a|na|no|de)\s+(.+)$/i) ||
      trimmed.match(/\bsubtarefa\s*[:=-]?\s*(.+)$/i);
    if (m && m[2]) {
      const subTitle = m[1]!.trim();
      const parentQ = m[2]!.trim();
      return resolveTaskTurn(parentQ, tasks, opts.entityHint, (t) =>
        proposal({
          summary: `Subtarefa em «${t.title}»`,
          detail: `· ${subTitle}`,
          confidence: "high",
          action: {
            type: "addSubtask",
            id: t.id,
            subtaskTitle: subTitle,
            parentTitle: t.title,
          },
        }),
      );
    }
    return {
      type: "unknown",
      text: "Formato: «subtarefa WhatsApp em Redes Sociais».",
    };
  }

  // —— Feita / concluir ——
  if (
    /\b(como feita|feita|conclui|concluir|concluí|completei|terminei|done)\b/.test(f) ||
    /\bmarca\b/.test(f) && /\bfeita\b/.test(f)
  ) {
    let q = extractAfterCue(
      trimmed,
      /^(marca|marcar|conclui|concluir|completei|terminei)\s+/i,
    );
    q = q
      .replace(/\s*(como\s+)?feita\b/i, "")
      .replace(/\s*como\s+feita\b/i, "")
      .replace(/^tarefa\s+/i, "")
      .trim();
    if (!q) q = stripEntityWords(trimmed.replace(/\b(marca|como|feita|conclui|concluir|completei|terminei|tarefa)\b/gi, " "));
    return resolveTaskTurn(q, tasks, opts.entityHint, (t) =>
      proposal({
        summary: `Concluir «${t.title}»`,
        detail: `${entityLabel(t.entityId)} · passa a Feito`,
        confidence: "high",
        action: { type: "setStatus", id: t.id, status: "feita", title: t.title },
      }),
    );
  }

  // —— Foco ——
  if (/\b(foca|focar|prioridade|hoje\s*[:=])/i.test(trimmed) && !/\b(o que|atrasad|inbox)\b/.test(f)) {
    let q = extractAfterCue(
      trimmed,
      /^(foca|focar|prioridade(\s+hoje)?|hoje)\s*[:=-]?\s*/i,
    );
    q = q.replace(/^tarefa\s+/i, "").trim();
    if (!q) {
      return { type: "unknown", text: "Ex.: «foca TCC» ou «prioridade hoje: fluxo diário»." };
    }
    return resolveTaskTurn(q, tasks, opts.entityHint, (t) =>
      proposal({
        summary: t.focusToday ? `Tirar «Hoje» de «${t.title}»` : `Marcar «${t.title}» como Hoje`,
        detail: `${entityLabel(t.entityId)} · máx. 3 prioridades do dia`,
        confidence: "high",
        action: { type: "toggleFocus", id: t.id, title: t.title },
      }),
    );
  }

  // —— Prazo ——
  if (/\bprazo\b/.test(f)) {
    const due = parseDueToken(trimmed) || todayYmd();
    let q = trimmed
      .replace(/\bprazo\b/gi, " ")
      .replace(/\b(hoje|amanha|amanhã)\b/gi, " ")
      .replace(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)\b/g, " ")
      .replace(/\b(para|em|de|a|o|tarefa)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!q) {
      return { type: "unknown", text: "Ex.: «prazo amanhã para preçário»." };
    }
    return resolveTaskTurn(q, tasks, opts.entityHint, (t) =>
      proposal({
        summary: `Prazo ${due} em «${t.title}»`,
        detail: entityLabel(t.entityId),
        confidence: "high",
        action: { type: "setDue", id: t.id, due, title: t.title },
      }),
    );
  }

  return {
    type: "unknown",
    text:
      "Tenta: «o que tenho hoje», «atrasadas», «inbox», «adiciona tarefa … na PDS», «marca X como feita», «foca X», «prazo amanhã para X», «subtarefa Y em X».",
  };
}

/** Aplica subtarefa ao array (puro). */
export function withNewSubtask(task: Task, title: string): Task {
  return {
    ...task,
    subtasks: [...(task.subtasks ?? []), createSubtask(title)],
  };
}
