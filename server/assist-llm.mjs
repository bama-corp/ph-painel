/**
 * LLM como intérprete do Assistente (não aplica movimentos).
 * Provider: Groq via AI SDK (`generateObject`).
 * Env: GROQ_API_KEY · opcional ASSIST_MODEL (id Groq).
 */

import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const intentSchema = z.object({
  intent: z.enum([
    "movement",
    "pay_party",
    "collect_party",
    "add_note",
    "definition",
    "balance",
    "metric",
    "panel_info",
    "clarify",
    "unknown",
  ]),
  /** Frase canónica em PT para o motor local (ex. «Paguei Tuni 5000 no BAI»). */
  rewrittenLine: z.string().nullable(),
  amount: z.number().nullable(),
  entityHint: z.string().nullable(),
  accountHint: z.string().nullable(),
  partyHint: z.string().nullable(),
  movementKind: z.string().nullable(),
  noteTitle: z.string().nullable(),
  noteBody: z.string().nullable(),
  definitionTopic: z.string().nullable(),
  clarifyQuestion: z.string().nullable(),
  summaryPt: z.string(),
});

export function assistLlmConfigured() {
  return Boolean((process.env.GROQ_API_KEY || "").trim());
}

function groqModel() {
  const id = (process.env.ASSIST_MODEL || "llama-3.3-70b-versatile").trim();
  const groq = createGroq({
    apiKey: (process.env.GROQ_API_KEY || "").trim(),
  });
  return groq(id);
}

/**
 * @param {{ text: string, catalog?: string, pendingSummary?: string | null }} opts
 */
export async function interpretWithLlm(opts) {
  if (!assistLlmConfigured()) {
    return { ok: false, configured: false, error: "GROQ_API_KEY em falta." };
  }

  const catalog = opts.catalog || "(sem catálogo)";
  const pending = opts.pendingSummary
    ? `Há uma proposta pendente: ${opts.pendingSummary}`
    : "Não há proposta pendente.";

  try {
    const { object } = await generateObject({
      model: groqModel(),
      schema: intentSchema,
      temperature: 0,
      prompt: `És o intérprete do painel financeiro PH (Angola, Kz).
NÃO inventes saldos nem valores. NÃO digas para gravar sozinho — só classifica a intenção.
O motor local valida contas/parties e pede confirmação ao utilizador.

Catálogo (contas, parties, entidades):
${catalog}

${pending}

Mensagem do utilizador:
"""${opts.text}"""

Regras:
- Se for movimento/pagamento/cobrança: preenche rewrittenLine numa frase curta e clara em português (ex. «Paguei Tuni 5000 no BAI», «Recebi 12000 no caixa PDS»).
- Se for nota no Caderno: intent=add_note, noteTitle + noteBody (ou topic em noteTitle).
- Se for «o que é X» / conceito: intent=definition, definitionTopic=X.
- Se for saldo/dívidas: intent=balance, rewrittenLine com a pergunta limpa.
- Se for lucro/MRR/métrica: intent=metric.
- Se precisares de esclarecer: intent=clarify + clarifyQuestion.
- summaryPt: uma linha em PT a explicar o que entendeste.
- Se não der: intent=unknown.`,
    });

    return { ok: true, configured: true, intent: object };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Falha LLM",
    };
  }
}

/** Catálogo compacto para o prompt (sem saldos). */
export function buildAssistCatalog(state) {
  if (!state?.accounts) return "";
  const accounts = (state.accounts || [])
    .map((a) => `${a.id}:${a.name}(${a.entityId})`)
    .join(", ");
  const parties = (state.parties || [])
    .slice(0, 40)
    .map((p) => `${p.id}:${p.name}(${p.side})`)
    .join(", ");
  return `Contas: ${accounts}\nParties: ${parties}\nEntidades: pessoal, cw=PDS, rove=Plural, picasso, ph`;
}
