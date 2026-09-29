/**
 * Cliente: LLM interpreta → motor local valida/propõe.
 * Sem chave no servidor: cai sempre para interpretChat local.
 */
import {
  answerBalanceQuestion,
  answerDefinitionQuestion,
  formatManualAnswer,
  interpretChat,
  parseCadernoNoteIntent,
  parseReportLine,
  type ChatTurn,
  type ReportProposal,
} from "./dailyReport";
import { findManualDefinition } from "./cadernoManual";
import { answerMetricQuestion } from "./assistMetrics";
import { answerPanelQuestion } from "./assistPanel";
import type { AppState } from "./types";

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const API_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

export type AssistLlmIntent = {
  intent: string;
  rewrittenLine: string | null;
  amount: number | null;
  entityHint: string | null;
  accountHint: string | null;
  partyHint: string | null;
  movementKind: string | null;
  noteTitle: string | null;
  noteBody: string | null;
  definitionTopic: string | null;
  clarifyQuestion: string | null;
  summaryPt: string;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

export async function fetchAssistLlmStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/assist/interpret`, { headers: headers() });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

function buildCatalog(state: AppState): string {
  const accounts = state.accounts.map((a) => `${a.id}:${a.name}(${a.entityId})`).join(", ");
  const parties = state.parties
    .slice(0, 40)
    .map((p) => `${p.id}:${p.name}(${p.side})`)
    .join(", ");
  return `Contas: ${accounts}\nParties: ${parties}\nEntidades: pessoal, cw=PDS, rove=Plural, picasso, ph`;
}

async function fetchLlmIntent(
  text: string,
  state: AppState,
  pending: ReportProposal | null,
): Promise<AssistLlmIntent | null> {
  try {
    const res = await fetch(`${API_BASE}/api/assist/interpret`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        text,
        catalog: buildCatalog(state),
        pendingSummary: pending ? `${pending.summary} · ${pending.detail}` : null,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; intent?: AssistLlmIntent };
    return data.ok && data.intent ? data.intent : null;
  } catch {
    return null;
  }
}

function needsLlmBoost(local: ChatTurn): boolean {
  if (local.type === "confirm" || local.type === "skip" || local.type === "revise") return false;
  if (local.type === "info") return false;
  if (local.type === "clarify") return false;
  if (local.type === "orphan_fix") return true;
  if (local.type === "fresh") {
    const a = local.proposal.action;
    if (a.type === "unknown") return true;
    if (local.proposal.confidence === "low") return true;
  }
  return false;
}

function mapIntentToTurn(
  intent: AssistLlmIntent,
  state: AppState,
  at: string,
  original: string,
): ChatTurn | null {
  const line = (intent.rewrittenLine || original).trim();

  if (intent.intent === "add_note") {
    const topic = intent.noteTitle || intent.definitionTopic || "";
    const crafted = topic
      ? `Mete no caderno sobre ${topic}`
      : `Anota no caderno: ${intent.noteTitle || "Nota"}\n${intent.noteBody || ""}`;
    const fromPhrase = parseCadernoNoteIntent(crafted, at);
    if (fromPhrase && fromPhrase.action.type === "addNote") return { type: "fresh", proposal: fromPhrase };
    if (intent.noteTitle && intent.noteBody) {
      return {
        type: "fresh",
        proposal: {
          id: `note-llm-${Date.now().toString(36)}`,
          line: original,
          summary: `Nota no Caderno · ${intent.noteTitle}`,
          detail: intent.noteBody.slice(0, 280),
          confidence: "medium",
          action: {
            type: "addNote",
            title: intent.noteTitle,
            body: intent.noteBody,
            at,
          },
        },
      };
    }
    const hit = topic ? findManualDefinition(topic) : null;
    if (hit) {
      return {
        type: "fresh",
        proposal: {
          id: `note-llm-${Date.now().toString(36)}`,
          line: original,
          summary: `Nota no Caderno · ${hit.t}`,
          detail: hit.d.slice(0, 280),
          confidence: "high",
          action: { type: "addNote", title: hit.t, body: hit.d, at },
        },
      };
    }
  }

  if (intent.intent === "definition") {
    const topic = intent.definitionTopic || line;
    const hit = findManualDefinition(topic);
    if (hit) return { type: "info", text: formatManualAnswer(hit) };
    const def = answerDefinitionQuestion(`o que é ${topic}?`);
    if (def) return { type: "info", text: def };
  }

  if (intent.intent === "balance") {
    const bal = answerBalanceQuestion(line, state);
    if (bal) return { type: "info", text: bal };
  }

  if (intent.intent === "metric") {
    const m = answerMetricQuestion(line, state);
    if (m) return { type: "info", text: m };
  }

  if (intent.intent === "panel_info") {
    const p = answerPanelQuestion(line, state);
    if (p) return { type: "info", text: p };
  }

  if (intent.intent === "clarify" && intent.clarifyQuestion) {
    return { type: "info", text: `${intent.clarifyQuestion}\n\n— Assistente` };
  }

  if (
    intent.intent === "movement" ||
    intent.intent === "pay_party" ||
    intent.intent === "collect_party"
  ) {
    const proposal = parseReportLine(line, state, at);
    if (proposal.action.type !== "unknown") {
      return {
        type: "fresh",
        proposal: {
          ...proposal,
          detail: intent.summaryPt
            ? `${proposal.detail}\n(LLM: ${intent.summaryPt})`
            : proposal.detail,
        },
      };
    }
  }

  return null;
}

/**
 * Interpreta: regras locais primeiro; LLM só se o local for fraco/desconhecido.
 */
export async function interpretAssistant(
  text: string,
  state: AppState,
  at: string,
  pending: ReportProposal | null,
): Promise<ChatTurn> {
  const local = interpretChat(text, state, at, pending);
  if (!needsLlmBoost(local)) return local;

  const intent = await fetchLlmIntent(text, state, pending);
  if (!intent) return local;

  const mapped = mapIntentToTurn(intent, state, at, text);
  if (mapped) return mapped;

  // LLM não ajudou → local (unknown / low)
  if (local.type === "fresh" && intent.summaryPt) {
    return {
      type: "fresh",
      proposal: {
        ...local.proposal,
        detail: `${local.proposal.detail}\n(LLM: ${intent.summaryPt})`,
      },
    };
  }
  return local;
}
