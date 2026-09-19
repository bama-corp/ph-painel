/**
 * Assistente de relatório do dia — interpreta frases em PT e propõe movimentos PH.
 * Pipeline: extractSlots → scoreIntents → proposta (ou clarificação).
 * Não aplica sozinho: a UI confirma antes de gravar no ledger.
 */
import { KIND_LABEL, custodyInAccount, liquidityByEntity, liquidityOf, ownLiquidityOf, partyOf, personalOwnLiquidity } from "./engine";
import { entityShort } from "./labels";
import { findManualDefinition } from "./cadernoManual";
import { roundKz } from "./money";
import { COMPANIES, type AppState, type EntityId, type Movement, type MovementKind, type Party } from "./types";

export type ReportAction =
  | { type: "movement"; draft: Omit<Movement, "id"> }
  | {
      type: "payParty";
      partyId: string;
      accountId: string;
      amount: number;
      at: string;
      note?: string;
    }
  | {
      type: "collectParty";
      partyId: string;
      accountId: string;
      amount: number;
      at: string;
      note?: string;
    }
  | { type: "unknown"; reason: string };

export type ReportProposal = {
  id: string;
  line: string;
  summary: string;
  detail: string;
  confidence: "high" | "medium" | "low";
  action: ReportAction;
  /** Quando o score empata — chips na UI. */
  clarifyOptions?: ClarifyOption[];
};

export type ClarifyOption = {
  label: string;
  proposal: ReportProposal;
};

export type IntentId =
  | "loan_owner"
  | "pay_custody"
  | "pay_party"
  | "collect_party"
  | "receita"
  | "despesa"
  | "reembolso";

export type ReportSlots = {
  text: string;
  amount: number | null;
  entity: EntityId;
  accountId: string | null;
  party: Party | null;
  custody: boolean;
  ofSomeone: boolean;
  releaseCue: boolean;
  loanCue: boolean;
  repayCue: boolean;
  collectCue: boolean;
  payCue: boolean;
  incomeCue: boolean;
  expenseCue: boolean;
  depositCue: boolean;
};

type ScoredIntent = {
  id: IntentId;
  score: number;
  label: string;
};

const CLEAR_MARGIN = 2.5;
const MIN_SCORE = 5;

const ENTITY_ALIASES: { re: RegExp; id: EntityId }[] = [
  { re: /\b(pds|padstation|cw)\b/i, id: "cw" },
  { re: /\b(plural|rove)\b/i, id: "rove" },
  { re: /\b(picasso'?s?|picasso)\b/i, id: "picasso" },
  { re: /(^|\s)ph(\s|$)/i, id: "ph" },
  { re: /\b(pessoal|eu|mim)\b/i, id: "pessoal" },
];

const STOP_TOKENS = new Set([
  "os",
  "as",
  "do",
  "da",
  "dos",
  "das",
  "de",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "que",
  "com",
  "para",
  "por",
  "uma",
  "uns",
  "kz",
  "kwanza",
  "kwanzas",
  "estavam",
  "estava",
  "estao",
  "estão",
  "custodia",
  "custódia",
  "terceiros",
  "terceiro",
  "emprestei",
  "emprestimo",
  "empréstimo",
  "tirei",
  "usei",
  "saquei",
  "retirei",
  "devolvi",
  "entreguei",
  "libertei",
  "paguei",
  "pago",
  "pagamento",
  "cobrei",
  "recebi",
  "gastei",
  "comprei",
  "despesa",
  "receita",
  "meti",
  "pus",
  "depositei",
  "transferi",
]);

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Extrai valor em Kz: 2000 · 2.000 · 10 mil · 2 milhões · 2.000,50 */
export function parseAmountKz(text: string): number | null {
  const milhao = text.match(/(\d+(?:[.,]\d+)?)\s*milh[oõ]es?\b/i);
  if (milhao) {
    const n = Number(milhao[1]!.replace(",", ".")) * 1_000_000;
    if (Number.isFinite(n) && n > 0) return roundKz(n);
  }
  const mil = text.match(/(\d+(?:[.,]\d+)?)\s*mil\b/i);
  if (mil) {
    const n = Number(mil[1]!.replace(",", ".")) * 1_000;
    if (Number.isFinite(n) && n > 0) return roundKz(n);
  }

  const m = text.match(
    /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:kz|kz\.|kwanzas?)?/i,
  );
  if (!m) return null;
  const intPart = m[1]!.replace(/[.\s]/g, "");
  const dec = m[2] ?? "00";
  const n = Number(`${intPart}.${dec.padEnd(2, "0").slice(0, 2)}`);
  return Number.isFinite(n) && n > 0 ? roundKz(n) : null;
}

export function detectEntity(text: string, fallback: EntityId = "pessoal"): EntityId {
  for (const a of ENTITY_ALIASES) {
    if (a.re.test(text)) return a.id;
  }
  return fallback;
}

function pickAccount(state: AppState, entity: EntityId, prefer: string[] = []): string | null {
  const accounts = state.accounts.filter((a) => a.entityId === entity);
  for (const id of prefer) {
    const a = accounts.find((x) => x.id === id);
    if (a && liquidityOf(state, a.id) > 0) return a.id;
  }
  for (const id of prefer) {
    if (accounts.some((x) => x.id === id)) return id;
  }
  const withCash = [...accounts].sort((a, b) => liquidityOf(state, b.id) - liquidityOf(state, a.id));
  return withCash[0]?.id ?? accounts[0]?.id ?? null;
}

function partyTokens(p: Party): string[] {
  return fold(p.name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
}

/** Encontra party pelo nome (ex. «Eliandro», «Lenu», «Tuni»). */
export function findParty(state: AppState, text: string): Party | null {
  const lower = fold(text);
  let best: { p: Party; score: number } | null = null;
  for (const p of state.parties) {
    const tokens = partyTokens(p);
    if (!tokens.length) continue;
    let score = 0;
    for (const t of tokens) {
      if (lower.includes(t)) score += t.length >= 5 ? 3 : 2;
    }
    const first = tokens[0]!;
    if (lower.includes(first)) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

/** Nome suspeito após «do/da» quando a party ainda não existe no ledger. */
function hintedPersonName(text: string): string | null {
  const m = fold(text).match(/\b(?:do|da|de)\s+([a-z]{3,})(?:\s|$)/);
  if (!m) return null;
  const name = m[1]!;
  if (STOP_TOKENS.has(name) || ENTITY_ALIASES.some((a) => a.re.test(name))) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function mentionsCustody(text: string) {
  return /cust[oó]dia|terceiros?/i.test(text);
}

function accountLabel(state: AppState, id: string) {
  return state.accounts.find((a) => a.id === id)?.name ?? id;
}

/**
 * Conta mencionada na frase: «caixa pessoal», «BAI», «caixa PDS», …
 */
export function detectAccount(
  state: AppState,
  text: string,
  preferEntity?: EntityId,
): string | null {
  const lower = fold(text);

  const byId = (id: string) => (state.accounts.some((a) => a.id === id) ? id : null);

  if (/caixa\s*pds|caixa\s*(da\s+)?(pds|cw|padstation)/i.test(text)) return byId("cw-caixa");
  if (/caixa\s*plural|caixa\s*(da\s+)?(plural|rove)/i.test(text)) return byId("rove-caixa");
  if (/caixa\s*picasso/i.test(text)) return byId("picasso-caixa");
  if (/caixa\s*ph\b/i.test(text)) return byId("ph-caixa");
  if (
    /\b(caixa\s*pessoal|caixa\s*(de\s*)?(eu|mim)|na\s*caixa|em\s*caixa|do\s*caixa|da\s*caixa)\b/i.test(
      text,
    ) ||
    (/\bcaixa\b/i.test(text) && !/caixa\s*(pds|plural|picasso|ph|cw|rove)/i.test(text))
  ) {
    const prefer =
      preferEntity && preferEntity !== "pessoal"
        ? byId(
            preferEntity === "cw"
              ? "cw-caixa"
              : preferEntity === "rove"
                ? "rove-caixa"
                : preferEntity === "picasso"
                  ? "picasso-caixa"
                  : "ph-caixa",
          )
        : byId("caixa-p");
    if (prefer) return prefer;
  }

  if (/\bbai\s*2\b|\bbai2\b/i.test(text)) {
    if (preferEntity === "cw" || preferEntity === undefined) return byId("cw-bai2") ?? byId("bai");
    return byId("bai");
  }
  if (/\bbai\b/i.test(text)) return byId("bai");
  if (/\bbfa\b/i.test(text)) return byId("bfa");
  if (/\bstand\b/i.test(text)) return byId("stand");
  if (/\batlantico\b|\batlântico\b/i.test(text)) {
    const a = state.accounts.find((x) => /atlantico/i.test(x.name));
    if (a) return a.id;
  }

  let best: { id: string; score: number } | null = null;
  for (const a of state.accounts) {
    if (preferEntity && a.entityId !== preferEntity) continue;
    const name = fold(a.name);
    const tokens = name.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    let score = 0;
    if (lower.includes(name) && name.length >= 3) score += 5;
    for (const t of tokens) {
      if (t === "caixa" || t === "conta") continue;
      // palavra completa — evita «ph» dentro de «empresa»
      const re = new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`);
      if (re.test(lower)) score += t.length >= 4 ? 3 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: a.id, score };
  }
  return best?.id ?? null;
}

function preferAccountsFromText(state: AppState, text: string, entity: EntityId, fallback: string[]) {
  const hit = detectAccount(state, text, entity);
  if (hit) {
    const acc = state.accounts.find((a) => a.id === hit);
    if (acc?.entityId === entity) return [hit, ...fallback.filter((x) => x !== hit)];
  }
  return fallback;
}

function describeAction(
  state: AppState,
  action: ReportAction,
): { summary: string; detail: string } | null {
  if (action.type === "unknown") return null;
  if (action.type === "payParty") {
    const party = state.parties.find((p) => p.id === action.partyId);
    const name = party?.name ?? action.partyId;
    const custody = party?.ownership === "custody";
    return {
      summary: `${custody ? "Custódia" : "Pagamento"} · ${name} · ${action.amount.toLocaleString("pt-PT")} Kz`,
      detail: `Sai de «${accountLabel(state, action.accountId)}» e reduz ${custody ? "a custódia" : "a dívida"} de «${name}».`,
    };
  }
  if (action.type === "collectParty") {
    const party = state.parties.find((p) => p.id === action.partyId);
    const name = party?.name ?? action.partyId;
    return {
      summary: `Cobrança · ${name} · ${action.amount.toLocaleString("pt-PT")} Kz`,
      detail: `Entra em «${accountLabel(state, action.accountId)}».`,
    };
  }
  const d = action.draft;
  if (d.kind === "emprestimo_proprietario") {
    const from = d.from.type === "liquidity" ? d.from.id : "?";
    const to = d.to.type === "liquidity" ? d.to.id : "?";
    return {
      summary: `Empréstimo ao proprietário · ${d.amount.toLocaleString("pt-PT")} Kz`,
      detail: `${entityShort(d.entityId)} «${accountLabel(state, from)}» → pessoal «${accountLabel(state, to)}». Sobe a conta corrente.`,
    };
  }
  if (d.kind === "reembolso") {
    const from = d.from.type === "liquidity" ? d.from.id : "?";
    const to = d.to.type === "liquidity" ? d.to.id : "?";
    return {
      summary: `Reembolso à ${entityShort(d.entityId)} · ${d.amount.toLocaleString("pt-PT")} Kz`,
      detail: `Pessoal «${accountLabel(state, from)}» → ${entityShort(d.entityId)} «${accountLabel(state, to)}».`,
    };
  }
  if (d.kind === "receita") {
    const to = d.to.type === "liquidity" ? d.to.id : "?";
    return {
      summary: `Receita · ${entityShort(d.entityId)} · ${d.amount.toLocaleString("pt-PT")} Kz`,
      detail: `Entra em «${accountLabel(state, to)}».`,
    };
  }
  if (d.kind === "despesa") {
    const from = d.from.type === "liquidity" ? d.from.id : "?";
    return {
      summary: `Despesa · ${entityShort(d.entityId)} · ${d.amount.toLocaleString("pt-PT")} Kz`,
      detail: `Sai de «${accountLabel(state, from)}»${d.entityId === "pessoal" ? " · bolso operacional" : ""}.`,
    };
  }
  return {
    summary: `${KIND_LABEL[d.kind]} · ${d.amount.toLocaleString("pt-PT")} Kz`,
    detail: "Revê antes de gravar.",
  };
}

function withLabels(state: AppState, p: ReportProposal): ReportProposal {
  const labels = describeAction(state, p.action);
  if (!labels) return p;
  return { ...p, summary: labels.summary, detail: labels.detail };
}

export type ChatTurn =
  | { type: "confirm" }
  | { type: "skip" }
  | { type: "revise"; proposal: ReportProposal; tip: string }
  | { type: "fresh"; proposal: ReportProposal }
  | { type: "clarify"; text: string; options: ClarifyOption[] }
  | { type: "info"; text: string }
  | { type: "orphan_fix"; text: string };

function fmtKz(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function hasMovementVerb(text: string) {
  return /\b(emprestei|usei|gastei|paguei|recebi|cobrei|reembolsei|tirei|meti|pus|devolvi|comprei|transferi)\b/i.test(
    text,
  );
}

/** «o que é custódia?», «como calcular um pró-labore?», «explica alocável» */
export function isDefinitionQuery(text: string) {
  const t = text.trim();
  if (!t || hasMovementVerb(t) || parseAmountKz(t)) return false;
  const f = fold(t);
  return (
    /o\s+que\s+(e|significa)\s+\S/.test(f) ||
    /como\s+(calcular|fazer|registar|meter|definir|usar|ler|tirar)\b/.test(f) ||
    /^(significa|explica(\-me)?|define)\s+\S/.test(f) ||
    /definicao\s+(de\s+)?\S/.test(f)
  );
}

export function extractDefinitionTopic(text: string): string | null {
  const f = fold(text.trim());
  // «como fazer e calcular lucro» → fica a frase útil para scoring por palavras
  const m =
    f.match(/como\s+((?:calcular|fazer|registar|meter|definir|usar|ler|tirar)\b.*)$/) ||
    f.match(/o\s+que\s+(?:e|significa)\s+(.+?)\s*[\?\!\.]*$/) ||
    f.match(/(?:significa|explica(?:\-me)?|define)\s+(.+?)\s*[\?\!\.]*$/) ||
    f.match(/definicao\s+(?:de\s+)?(.+?)\s*[\?\!\.]*$/);
  if (!m?.[1]) return null;
  return m[1].replace(/[\?\!\.]+$/g, "").trim();
}

/** Formata corpo do glossário para o chat (passos em linhas). */
export function formatManualAnswer(term: { t: string; d: string }): string {
  let body = term.d
    .replace(/\s*(\d+)[.)]\s+/g, "\n$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.startsWith("\n")) body = body.slice(1);
  return `${term.t}\n\n${body}\n\n— Caderno · Glossário`;
}

export function answerDefinitionQuestion(text: string): string | null {
  if (!isDefinitionQuery(text)) return null;
  const topic = extractDefinitionTopic(text);
  if (!topic) {
    return "Pergunta «o que é …» ou «como calcular …».\nEx.: «o que é custódia?», «como calcular lucro?».\n\n— Caderno · Glossário";
  }
  const hit = findManualDefinition(topic);
  if (!hit) {
    return `Não encontrei «${topic}» no glossário.\nTenta: «como calcular lucro?», «o que é custódia?», «como calcular um pró-labore?».\n\n— Caderno · Glossário`;
  }
  return formatManualAnswer(hit);
}

/** Pergunta de saldo / «quanto tenho» — não é movimento. */
export function isBalanceQuestion(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (isDefinitionQuery(t)) return false;
  if (parseAmountKz(t) && hasMovementVerb(t)) return false;
  return (
    /\b(quanto|quantos|saldo|tenho|tens|tem|têm|resta|restam|dispon[ií]vel)\b/i.test(t) ||
    /^(saldo|liquidez)\b/i.test(t)
  );
}

/** «minhas dívidas», «o que devo», «Minhas d…» */
export function isDebtQuery(text: string) {
  const t = text.trim();
  if (!t || hasMovementVerb(t) || isDefinitionQuery(t)) return false;
  return (
    /\b(d[ií]vidas?|o\s+que\s+devo|a\s+pagar)\b/i.test(t) ||
    /\bdevo\b/i.test(t) ||
    /^minhas?\s+d/i.test(t)
  );
}

/** «a receber», «quem me deve» */
export function isReceivableQuery(text: string) {
  const t = text.trim();
  if (!t || hasMovementVerb(t) || isDefinitionQuery(t)) return false;
  return /\b(a\s+receber|me\s+devem|quem\s+me\s+deve|cr[eé]ditos?)\b/i.test(t);
}

/** «e a Picasso's», «PDS», menção a empresa sem valor = pedido de info. */
export function isEntityInfoQuery(text: string) {
  const t = text.trim();
  if (!t || parseAmountKz(t) || hasMovementVerb(t)) return false;
  if (/^e\s+/i.test(t)) return true;
  for (const a of ENTITY_ALIASES) {
    if (a.id === "pessoal") continue;
    if (a.re.test(t)) return true;
  }
  return false;
}

function formatEntityCash(state: AppState, entity: EntityId): string {
  const total = liquidityByEntity(state, entity);
  const accounts = state.accounts.filter((a) => a.entityId === entity);
  const lines = accounts
    .map((a) => {
      const liq = liquidityOf(state, a.id);
      if (Math.abs(liq) < 0.001 && accounts.length > 1) return null;
      return `· ${a.name}: ${fmtKz(liq)} Kz`;
    })
    .filter(Boolean);
  const head = `${entityShort(entity)}: ${fmtKz(total)} Kz no total.`;
  if (!lines.length) return head;
  return `${head}\n${lines.join("\n")}`;
}

function formatCompaniesCash(state: AppState): string {
  const lines = COMPANIES.map((id) => `· ${entityShort(id)}: ${fmtKz(liquidityByEntity(state, id))} Kz`);
  return `Caixa de cada empresa:\n${lines.join("\n")}\nIsto não é teu para gastar.`;
}

function formatDebts(state: AppState): string {
  const own = state.parties.filter(
    (p) =>
      p.entityId === "pessoal" &&
      p.side === "pagar" &&
      p.ownership === "own" &&
      partyOf(state, p.id) > 0.001,
  );
  const custody = state.parties.filter(
    (p) =>
      p.entityId === "pessoal" &&
      p.side === "pagar" &&
      p.ownership === "custody" &&
      partyOf(state, p.id) > 0.001,
  );
  const parts: string[] = [];
  if (own.length) {
    const sum = own.reduce((s, p) => s + partyOf(state, p.id), 0);
    parts.push(
      `Dívidas próprias (${fmtKz(sum)} Kz):\n` +
        own.map((p) => `· ${p.name}: ${fmtKz(partyOf(state, p.id))} Kz`).join("\n"),
    );
  } else {
    parts.push("Dívidas próprias: nenhuma com saldo.");
  }
  if (custody.length) {
    const sum = custody.reduce((s, p) => s + partyOf(state, p.id), 0);
    parts.push(
      `Custódia de terceiros (${fmtKz(sum)} Kz) — não é dívida tua:\n` +
        custody.map((p) => `· ${p.name}: ${fmtKz(partyOf(state, p.id))} Kz`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

function formatReceivables(state: AppState): string {
  const list = state.parties.filter(
    (p) => p.entityId === "pessoal" && p.side === "receber" && partyOf(state, p.id) > 0.001,
  );
  if (!list.length) return "A receber: ninguém te deve com saldo positivo.";
  const sum = list.reduce((s, p) => s + partyOf(state, p.id), 0);
  return (
    `A receber (${fmtKz(sum)} Kz):\n` +
    list.map((p) => `· ${p.name}: ${fmtKz(partyOf(state, p.id))} Kz`).join("\n")
  );
}

/** Resposta informativa a partir do ledger (contas, empresas, dívidas, liquidez). */
export function answerBalanceQuestion(text: string, state: AppState): string | null {
  const t = text.trim();
  const wantsInfo =
    isBalanceQuestion(t) || isEntityInfoQuery(t) || isDebtQuery(t) || isReceivableQuery(t);
  if (!wantsInfo) return null;

  // Dívidas / a receber (antes de fallbacks genéricos)
  if (isDebtQuery(t)) return formatDebts(state);
  if (isReceivableQuery(t)) return formatReceivables(state);

  // Todas as empresas
  if (
    /\bcada\s+empresa|todas\s+(as\s+)?empresas|saldo\s+das\s+empresas|quanto\s+tem\s+(cada|as)\b|\bempresas\b/i.test(
      t,
    )
  ) {
    return formatCompaniesCash(state);
  }

  const accId = detectAccount(state, t);
  if (accId) {
    const name = accountLabel(state, accId);
    const total = liquidityOf(state, accId);
    const own = ownLiquidityOf(state, accId);
    const cust = custodyInAccount(state, accId);
    let msg = `Em «${name}» tens ${fmtKz(total)} Kz no total.`;
    if (cust > 0.001) {
      msg += `\nTeu: ${fmtKz(own)} Kz · Custódia: ${fmtKz(cust)} Kz.`;
    }
    return msg;
  }

  // Empresa nomeada (Picasso's, PDS, Plural, PH) — inclusive «e a Picasso's»
  for (const a of ENTITY_ALIASES) {
    if (a.id === "pessoal") continue;
    if (a.re.test(t)) return formatEntityCash(state, a.id);
  }

  const party = findParty(state, t);
  if (party && (isBalanceQuestion(t) || /\b(devo|deve|dívida|divida|cust[oó]dia)\b/i.test(t))) {
    const due = partyOf(state, party.id);
    if (party.side === "pagar") {
      return party.ownership === "custody"
        ? `Custódia de «${party.name}»: ${fmtKz(due)} Kz.`
        : `Deves a «${party.name}»: ${fmtKz(due)} Kz.`;
    }
    return `«${party.name}» deve-te ${fmtKz(due)} Kz.`;
  }

  if (
    isBalanceQuestion(t) &&
    (/\b(pessoal|eu|mim|meu)\b/i.test(t) || /\bquanto\s+tenh/i.test(t) || /^saldo\b/i.test(t))
  ) {
    const own = personalOwnLiquidity(state);
    return `Liquidez própria (pessoal): ${fmtKz(own)} Kz.\nDiz a conta ou empresa — ex. «quanto tenho no BAI», «e a Picasso's», «quanto tem cada empresa».\nOu pergunta «minhas dívidas» / «a receber».`;
  }

  return null;
}

/** Confirmação / cancelamento em linguagem natural. */
export function isAffirmative(text: string) {
  return /^(sim|ok|okay|confirma|confirmar|grava|gravar|pode|yes|yep|isso|certo)([,!.\s].*)?$/i.test(
    text.trim(),
  );
}

export function isNegative(text: string) {
  return /^(n[aã]o|nop|ignora|ignorar|cancela|cancelar|descarta|esquece)([,!.\s].*)?$/i.test(
    text.trim(),
  );
}

/**
 * Ajusta uma proposta pendente (conta, valor, party) sem precisar repetir a frase completa.
 */
export function reviseProposal(
  pending: ReportProposal,
  text: string,
  state: AppState,
  at?: string,
): { proposal: ReportProposal; tip: string } | null {
  const action = pending.action;
  if (action.type === "unknown") return null;

  const tips: string[] = [];
  let nextAction: ReportAction = action;
  const amount = parseAmountKz(text);
  const party = findParty(state, text);
  const when =
    at ??
    (action.type === "payParty" || action.type === "collectParty" ? action.at : state.asOf);

  if (action.type === "payParty" || action.type === "collectParty") {
    let accountId = action.accountId;
    let partyId = action.partyId;
    let amt = action.amount;
    const acc = detectAccount(state, text, state.parties.find((p) => p.id === partyId)?.entityId);
    if (acc && acc !== accountId) {
      accountId = acc;
      tips.push(`conta → «${accountLabel(state, acc)}»`);
    }
    if (amount && amount !== amt) {
      amt = amount;
      tips.push(`valor → ${amount.toLocaleString("pt-PT")} Kz`);
    }
    if (party && party.id !== partyId && party.side === (action.type === "payParty" ? "pagar" : "receber")) {
      partyId = party.id;
      tips.push(`party → «${party.name}»`);
    }
    if (!tips.length) return null;
    nextAction = { ...action, accountId, partyId, amount: amt, at: when };
  } else if (action.type === "movement") {
    const draft = { ...action.draft, at: when };
    let changed = false;
    if (amount && amount !== draft.amount) {
      draft.amount = amount;
      tips.push(`valor → ${amount.toLocaleString("pt-PT")} Kz`);
      changed = true;
    }
    const acc = detectAccount(state, text, draft.entityId);
    if (acc) {
      const accEnt = state.accounts.find((a) => a.id === acc)?.entityId;
      if (draft.kind === "receita" && draft.to.type === "liquidity") {
        draft.to = { type: "liquidity", id: acc };
        tips.push(`destino → «${accountLabel(state, acc)}»`);
        if (accEnt) draft.entityId = accEnt;
        changed = true;
      } else if (
        (draft.kind === "despesa" || draft.kind === "emprestimo_proprietario" || draft.kind === "reembolso") &&
        draft.from.type === "liquidity"
      ) {
        if (draft.kind === "emprestimo_proprietario" && accEnt === "pessoal" && draft.to.type === "liquidity") {
          draft.to = { type: "liquidity", id: acc };
          tips.push(`destino → «${accountLabel(state, acc)}»`);
          changed = true;
        } else if (draft.kind === "reembolso" && accEnt === "pessoal") {
          draft.from = { type: "liquidity", id: acc };
          tips.push(`origem → «${accountLabel(state, acc)}»`);
          changed = true;
        } else if (draft.kind === "emprestimo_proprietario" && accEnt && accEnt !== "pessoal") {
          draft.from = { type: "liquidity", id: acc };
          tips.push(`origem → «${accountLabel(state, acc)}»`);
          changed = true;
        } else if (draft.kind === "despesa") {
          draft.from = { type: "liquidity", id: acc };
          tips.push(`origem → «${accountLabel(state, acc)}»`);
          if (accEnt) draft.entityId = accEnt;
          changed = true;
        } else if (acc !== (draft.from.type === "liquidity" ? draft.from.id : "")) {
          draft.from = { type: "liquidity", id: acc };
          tips.push(`conta → «${accountLabel(state, acc)}»`);
          changed = true;
        }
      } else if (draft.to.type === "liquidity" && accEnt) {
        draft.to = { type: "liquidity", id: acc };
        tips.push(`destino → «${accountLabel(state, acc)}»`);
        changed = true;
      }
    }
    if (!changed) return null;
    nextAction = { type: "movement", draft: { ...draft, note: text } };
  } else {
    return null;
  }

  const proposal = withLabels(state, {
    ...pending,
    id: `rp-${Math.random().toString(36).slice(2, 9)}`,
    line: `${pending.line} · ${text}`,
    action: nextAction,
    confidence: "high",
    clarifyOptions: undefined,
  });
  return {
    proposal,
    tip: tips.join("; "),
  };
}

/**
 * Uma mensagem do chat: confirma, cancela, corrige a pendente, pergunta saldo, ou interpreta frase nova.
 */
export function interpretChat(
  text: string,
  state: AppState,
  at: string,
  pending: ReportProposal | null,
): ChatTurn {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      type: "fresh",
      proposal: {
        id: "empty",
        line: "",
        summary: "Ignorado",
        detail: "Linha vazia.",
        confidence: "low",
        action: { type: "unknown", reason: "vazio" },
      },
    };
  }

  // Definições do glossário («o que é custódia?»)
  const definition = answerDefinitionQuestion(trimmed);
  if (definition) return { type: "info", text: definition };

  // Perguntas de saldo / dívidas / empresas
  const balance = answerBalanceQuestion(trimmed, state);
  if (balance) return { type: "info", text: balance };

  if (pending) {
    if (isAffirmative(trimmed)) return { type: "confirm" };
    if (isNegative(trimmed)) return { type: "skip" };
    const revised = reviseProposal(pending, trimmed, state, at);
    if (revised) return { type: "revise", proposal: revised.proposal, tip: revised.tip };

    const sameAcc = detectAccount(state, trimmed);
    if (sameAcc) {
      const cur =
        pending.action.type === "payParty" || pending.action.type === "collectParty"
          ? pending.action.accountId
          : pending.action.type === "movement" && pending.action.draft.from.type === "liquidity"
            ? pending.action.draft.from.id
            : null;
      if (cur === sameAcc) {
        return {
          type: "orphan_fix",
          text: `Já está em «${state.accounts.find((a) => a.id === sameAcc)?.name ?? sameAcc}». Confirma com «sim» ou ajusta outra coisa.`,
        };
      }
    }

    const looksLikeCorrection =
      !parseAmountKz(trimmed) &&
      trimmed.split(/\s+/).length <= 12 &&
      !/\b(emprestei|usei|recebi|gastei|paguei|cobrei|reembolsei|tirei|meti|pus)\b/i.test(trimmed);
    if (looksLikeCorrection) {
      return {
        type: "orphan_fix",
        text: "Não percebi a correcção. Diz por exemplo «na caixa pessoal», «no BAI», «foi 25000» ou «sim» / «não».",
      };
    }
  } else {
    // Conta sozinha sem pergunta → não há proposta a corrigir
    if (!parseAmountKz(trimmed) && detectAccount(state, trimmed)) {
      return {
        type: "orphan_fix",
        text: "Não há proposta a corrigir. Diz o que aconteceu com valor, ou pergunta «quanto tenho no BAI».",
      };
    }
  }

  const proposal = parseReportLine(trimmed, state, at);
  if (proposal.clarifyOptions && proposal.clarifyOptions.length >= 2) {
    return {
      type: "clarify",
      text: `${proposal.summary}\n${proposal.detail}`,
      options: proposal.clarifyOptions,
    };
  }
  return { type: "fresh", proposal };
}

// —— Slots + intenções ——

export function extractSlots(text: string, state: AppState): ReportSlots {
  const amount = parseAmountKz(text);
  const entity = detectEntity(text);
  const party = findParty(state, text);
  const accountId = detectAccount(state, text, entity !== "pessoal" ? entity : undefined);
  const custody = mentionsCustody(text);
  const ofSomeone = /\b(do|da|de)\s+[a-zà-ú]{3,}/i.test(fold(text));

  const releaseCue =
    /\b(emprestei|usei|tirei|saquei|retirei|devolvi|entreguei|libertei|paguei|pago)\b/i.test(text);
  const loanCue =
    /\b(emprestei|empréstimo|emprestimo|tirei|saquei|retirei|usei)\b/i.test(text);
  const repayCue =
    /\b(reembolsei|paguei\s+à\s+pds|paguei\s+a\s+pds)\b/i.test(text) ||
    (/\bdevolvi\b/i.test(text) && entity !== "pessoal" && !custody && !(party?.ownership === "custody"));
  const collectCue =
    /\b(cobrei|cobrança|cobranca)\b/i.test(text) ||
    /\brecebi\b[\s\S]{0,40}\bd[eoa]\b/i.test(text);
  const payCue = /\b(paguei|pago|pagamento)\b/i.test(text);
  const depositCue = /\b(meti|pus|depositei)\b/i.test(text);
  const incomeCue =
    depositCue ||
    /\b(recebi|entrou|receita|venda|faturei|cobrança\s+loja)\b/i.test(text);
  const expenseCue = /\b(gastei|despesa|comprei|saída|saida)\b/i.test(text) ||
    (payCue && !party && entity !== "pessoal" && !repayCue);

  return {
    text,
    amount,
    entity,
    accountId,
    party,
    custody,
    ofSomeone,
    releaseCue,
    loanCue,
    repayCue,
    collectCue,
    payCue,
    incomeCue,
    expenseCue,
    depositCue,
  };
}

export function scoreIntents(slots: ReportSlots, _state: AppState): ScoredIntent[] {
  const scores: Record<IntentId, number> = {
    loan_owner: 0,
    pay_custody: 0,
    pay_party: 0,
    collect_party: 0,
    receita: 0,
    despesa: 0,
    reembolso: 0,
  };

  const { party, entity, custody, ofSomeone } = slots;
  const company = entity !== "pessoal";

  // Custódia / libertação de terceiro
  if (
    slots.releaseCue &&
    (custody || (party && (party.ownership === "custody" || ofSomeone))) &&
    !company
  ) {
    scores.pay_custody += 10;
    if (custody || party?.ownership === "custody") scores.pay_custody += 4;
    if (party?.side === "pagar") scores.pay_custody += 2;
  }

  // Empréstimo ao proprietário
  if (slots.loanCue && company) {
    scores.loan_owner += 12;
    if (/\b(usei|emprestei|tirei)\b/i.test(slots.text)) scores.loan_owner += 2;
  }

  // Reembolso
  if (slots.repayCue && company) {
    scores.reembolso += 11;
  }
  if (/\bdevolvi\b/i.test(slots.text) && company && !custody && party?.ownership !== "custody") {
    scores.reembolso += 8;
  }

  // Pagamento a party (dívida própria)
  if (party?.side === "pagar" && slots.payCue) {
    scores.pay_party += 10;
    if (party.ownership !== "custody") scores.pay_party += 2;
  }

  // Cobrança
  if (party?.side === "receber" && slots.collectCue) {
    scores.collect_party += 12;
  }
  if (party?.side === "receber" && slots.incomeCue && ofSomeone) {
    scores.collect_party += 9;
  }

  // Receita (sem cobrança de party)
  if (slots.incomeCue && !(party?.side === "receber" && (slots.collectCue || ofSomeone))) {
    scores.receita += 8;
  }
  if (slots.depositCue) scores.receita += 6;

  // Despesa
  if (slots.expenseCue) scores.despesa += 7;
  if (slots.payCue && !party && company && !slots.loanCue && !slots.repayCue) {
    scores.despesa += 5;
  }
  // Fallback fraco: empresa + valor sem cues fortes
  if (
    company &&
    slots.amount &&
    !slots.loanCue &&
    !slots.repayCue &&
    !slots.incomeCue &&
    !slots.expenseCue &&
    !slots.payCue &&
    !slots.collectCue &&
    !slots.releaseCue
  ) {
    scores.despesa += 4;
  }

  const labels: Record<IntentId, string> = {
    loan_owner: `Empréstimo ${entityShort(entity)}`,
    pay_custody: party ? `Custódia · ${party.name}` : "Custódia",
    pay_party: party ? `Pagar · ${party.name}` : "Pagamento",
    collect_party: party ? `Cobrar · ${party.name}` : "Cobrança",
    receita: `Receita · ${entityShort(entity)}`,
    despesa: `Despesa · ${entityShort(entity)}`,
    reembolso: `Reembolso · ${entityShort(entity)}`,
  };

  return (Object.keys(scores) as IntentId[])
    .map((id) => ({ id, score: scores[id], label: labels[id] }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildLoan(state: AppState, slots: ReportSlots, amount: number, at: string, base: { id: string; line: string }): ReportProposal {
  const entity = slots.entity;
  const fromPrefer = preferAccountsFromText(
    state,
    slots.text,
    entity,
    entity === "cw" ? ["cw-caixa", "cw-bai2"] : [],
  );
  const toPrefer = preferAccountsFromText(state, slots.text, "pessoal", ["caixa-p", "bai", "bfa"]);
  const fromId = pickAccount(state, entity, fromPrefer);
  const toId = pickAccount(state, "pessoal", toPrefer);
  if (!fromId || !toId) {
    return {
      ...base,
      summary: "Empréstimo — contas em falta",
      detail: "Não há conta de liquidez na empresa ou no pessoal.",
      confidence: "low",
      action: { type: "unknown", reason: "Contas em falta." },
    };
  }
  const draft: Omit<Movement, "id"> = {
    at,
    kind: "emprestimo_proprietario",
    amount,
    from: { type: "liquidity", id: fromId },
    to: { type: "liquidity", id: toId },
    entityId: entity,
    otherEntityId: "pessoal",
    costNature: "retirada",
    note: slots.text,
  };
  return withLabels(state, {
    ...base,
    confidence: "high",
    action: { type: "movement", draft },
    summary: "",
    detail: "",
  });
}

function buildReembolso(state: AppState, slots: ReportSlots, amount: number, at: string, base: { id: string; line: string }): ReportProposal {
  const entity = slots.entity;
  const fromId = pickAccount(state, "pessoal", preferAccountsFromText(state, slots.text, "pessoal", ["bai", "caixa-p"]));
  const toId = pickAccount(
    state,
    entity,
    preferAccountsFromText(state, slots.text, entity, entity === "cw" ? ["cw-caixa", "cw-bai2"] : []),
  );
  if (!fromId || !toId) {
    return {
      ...base,
      summary: "Reembolso — contas em falta",
      detail: "Falta liquidez pessoal ou da empresa.",
      confidence: "low",
      action: { type: "unknown", reason: "Contas em falta." },
    };
  }
  const draft: Omit<Movement, "id"> = {
    at,
    kind: "reembolso",
    amount,
    from: { type: "liquidity", id: fromId },
    to: { type: "liquidity", id: toId },
    entityId: entity,
    otherEntityId: "pessoal",
    costNature: "retirada",
    note: slots.text,
  };
  return withLabels(state, {
    ...base,
    confidence: "high",
    action: { type: "movement", draft },
    summary: "",
    detail: "",
  });
}

function buildPayCustody(
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
): ReportProposal {
  const party = slots.party;
  if (!party) {
    const hinted = hintedPersonName(slots.text);
    return {
      ...base,
      summary: hinted ? `Party «${hinted}» em falta` : "Party em falta",
      detail: hinted
        ? `Fala de «${hinted}», mas não há essa person no ledger. Cria em Contas (custódia / a pagar) e volta a dizer a frase.`
        : "Parece custódia de alguém, mas não reconheci o nome. Usa o nome exacto da party em Contas.",
      confidence: "low",
      action: {
        type: "unknown",
        reason: hinted ? `Party «${hinted}» inexistente.` : "Party inexistente.",
      },
    };
  }
  if (party.side !== "pagar") {
    return {
      ...base,
      summary: `«${party.name}» não é a pagar`,
      detail: "Custódia / devolução só faz sentido em parties a pagar. Se é a receber, diz «Cobrei …».",
      confidence: "low",
      action: { type: "unknown", reason: "Party a receber." },
    };
  }
  const due = partyOf(state, party.id);
  if (amount > due + 0.001) {
    return {
      ...base,
      summary: `Acima da custódia · ${party.name}`,
      detail: `Saldo de «${party.name}» é ${due.toLocaleString("pt-PT")} Kz — pediste ${amount.toLocaleString("pt-PT")} Kz.`,
      confidence: "low",
      action: { type: "unknown", reason: "Acima do saldo da party." },
    };
  }
  const prefer = preferAccountsFromText(state, slots.text, party.entityId, [
    "bai",
    "caixa-p",
    "stand",
    "bfa",
  ]);
  const held =
    party.heldInAccountId && state.accounts.some((a) => a.id === party.heldInAccountId)
      ? party.heldInAccountId
      : null;
  const accountId =
    held ?? pickAccount(state, party.entityId, prefer) ?? pickAccount(state, "pessoal", prefer)!;
  return withLabels(state, {
    ...base,
    confidence: slots.custody || party.ownership === "custody" ? "high" : "medium",
    action: {
      type: "payParty",
      partyId: party.id,
      accountId,
      amount,
      at,
      note: slots.text,
    },
    summary: "",
    detail: "",
  });
}

function buildPayParty(
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
): ReportProposal {
  const party = slots.party;
  if (!party || party.side !== "pagar") {
    return {
      ...base,
      summary: "Party a pagar em falta",
      detail: "Não reconheci a quem pagaste.",
      confidence: "low",
      action: { type: "unknown", reason: "Party em falta." },
    };
  }
  const prefer = preferAccountsFromText(state, slots.text, party.entityId, ["bai", "caixa-p"]);
  const accountId =
    pickAccount(state, party.entityId, prefer) ?? pickAccount(state, "pessoal", prefer)!;
  return withLabels(state, {
    ...base,
    confidence: "high",
    action: {
      type: "payParty",
      partyId: party.id,
      accountId,
      amount,
      at,
      note: slots.text,
    },
    summary: "",
    detail: "",
  });
}

function buildCollect(
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
): ReportProposal {
  const party = slots.party;
  if (!party || party.side !== "receber") {
    return {
      ...base,
      summary: "Party a receber em falta",
      detail: "Não reconheci de quem cobraste.",
      confidence: "low",
      action: { type: "unknown", reason: "Party em falta." },
    };
  }
  const prefer = preferAccountsFromText(state, slots.text, party.entityId, ["bai", "caixa-p"]);
  const accountId =
    pickAccount(state, party.entityId, prefer) ?? pickAccount(state, "pessoal", prefer)!;
  return withLabels(state, {
    ...base,
    confidence: "high",
    action: {
      type: "collectParty",
      partyId: party.id,
      accountId,
      amount,
      at,
      note: slots.text,
    },
    summary: "",
    detail: "",
  });
}

function buildReceita(
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
): ReportProposal {
  const ent0 = slots.entity;
  const prefer = preferAccountsFromText(
    state,
    slots.text,
    ent0,
    ent0 === "cw" ? ["cw-caixa", "cw-bai2"] : ent0 === "pessoal" ? ["bai", "caixa-p"] : [],
  );
  const destId = pickAccount(state, ent0, prefer);
  if (!destId) {
    return {
      ...base,
      summary: "Receita — sem conta",
      detail: "Não há conta de destino.",
      confidence: "low",
      action: { type: "unknown", reason: "Sem conta." },
    };
  }
  const ent = state.accounts.find((a) => a.id === destId)!.entityId;
  const draft: Omit<Movement, "id"> = {
    at,
    kind: "receita",
    amount,
    from: { type: "world" },
    to: { type: "liquidity", id: destId },
    entityId: ent,
    category: ent === "cw" ? "por_classificar" : undefined,
    note: slots.text,
  };
  return withLabels(state, {
    ...base,
    confidence: slots.depositCue || /\breceita|recebi|entrou\b/i.test(slots.text) ? "high" : "medium",
    action: { type: "movement", draft },
    summary: "",
    detail: "",
  });
}

function buildDespesa(
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
  inferred = false,
): ReportProposal {
  const ent = slots.entity;
  const prefer = preferAccountsFromText(
    state,
    slots.text,
    ent,
    ent === "cw" ? ["cw-caixa", "cw-bai2"] : ent === "pessoal" ? ["bai", "caixa-p"] : [],
  );
  const fromId = pickAccount(state, ent, prefer);
  if (!fromId) {
    return {
      ...base,
      summary: "Despesa — sem conta",
      detail: "Não há conta de saída.",
      confidence: "low",
      action: { type: "unknown", reason: "Sem conta." },
    };
  }
  const draft: Omit<Movement, "id"> = {
    at,
    kind: "despesa",
    amount,
    from: { type: "liquidity", id: fromId },
    to: { type: "world" },
    entityId: ent,
    costNature: ent === "cw" ? "variavel" : undefined,
    envelopeId: ent === "pessoal" ? "operacional" : undefined,
    note: slots.text,
  };
  if (inferred) {
    return {
      ...base,
      summary: `Despesa (inferida) · ${entityShort(ent)}`,
      detail: `Não reconheci o verbo — tratei como despesa de «${accountLabel(state, fromId)}». Revê antes de gravar.`,
      confidence: "low",
      action: { type: "movement", draft },
    };
  }
  return withLabels(state, {
    ...base,
    confidence: "medium",
    action: { type: "movement", draft },
    summary: "",
    detail: "",
  });
}

function buildFromIntent(
  intent: IntentId,
  state: AppState,
  slots: ReportSlots,
  amount: number,
  at: string,
  base: { id: string; line: string },
): ReportProposal {
  switch (intent) {
    case "loan_owner":
      return buildLoan(state, slots, amount, at, base);
    case "reembolso":
      return buildReembolso(state, slots, amount, at, base);
    case "pay_custody":
      return buildPayCustody(state, slots, amount, at, base);
    case "pay_party":
      return buildPayParty(state, slots, amount, at, base);
    case "collect_party":
      return buildCollect(state, slots, amount, at, base);
    case "receita":
      return buildReceita(state, slots, amount, at, base);
    case "despesa":
      return buildDespesa(state, slots, amount, at, base, slots.expenseCue === false && !slots.payCue);
    default:
      return {
        ...base,
        summary: "Não percebi",
        detail: "Intenção desconhecida.",
        confidence: "low",
        action: { type: "unknown", reason: "Padrão desconhecido." },
      };
  }
}

/**
 * Interpreta uma linha do relatório via slots + pontuação de intenções.
 */
export function parseReportLine(
  line: string,
  state: AppState,
  at = state.asOf,
): ReportProposal {
  const trimmed = line.trim();
  const id = `rp-${Math.random().toString(36).slice(2, 9)}`;
  const base = { id, line: trimmed };

  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
    return {
      ...base,
      summary: "Ignorado",
      detail: "Linha vazia ou comentário.",
      confidence: "low",
      action: { type: "unknown", reason: "vazio" },
    };
  }

  const slots = extractSlots(trimmed, state);
  if (!slots.amount) {
    return {
      ...base,
      summary: "Sem valor",
      detail: "Não encontrei um montante em Kz nesta linha.",
      confidence: "low",
      action: { type: "unknown", reason: "Sem montante." },
    };
  }

  const ranked = scoreIntents(slots, state);
  if (!ranked.length || ranked[0]!.score < MIN_SCORE) {
    const hinted = hintedPersonName(trimmed);
    return {
      ...base,
      summary: "Não percebi",
      detail: hinted
        ? `Vi o nome «${hinted}» mas não encaixei a frase. Exemplos: «Emprestei 30000 do ${hinted} em custódia», «Paguei ${hinted} 30000», «Emprestei 2000kz na PDS».`
        : "Tenta: «Emprestei 2000kz na PDS», «Emprestei 30000 do Lenu em custódia», «Recebi 5000 na PDS», «Paguei Tuni 10000», «Gastei 3000 pessoal».",
      confidence: "low",
      action: { type: "unknown", reason: "Padrão desconhecido." },
    };
  }

  const top = ranked[0]!;
  const second = ranked[1];
  const ambiguous =
    second &&
    second.score >= MIN_SCORE &&
    top.score - second.score < CLEAR_MARGIN &&
    top.id !== second.id;

  if (ambiguous && second) {
    const optA = buildFromIntent(top.id, state, slots, slots.amount, at, {
      id: `${id}-a`,
      line: trimmed,
    });
    const optB = buildFromIntent(second.id, state, slots, slots.amount, at, {
      id: `${id}-b`,
      line: trimmed,
    });
    // Só clarificar se ambas as opções são acções válidas
    if (optA.action.type !== "unknown" && optB.action.type !== "unknown") {
      return {
        ...base,
        summary: "Quiseste qual?",
        detail: `Pode ser «${top.label}» ou «${second.label}». Escolhe em baixo.`,
        confidence: "low",
        action: { type: "unknown", reason: "Ambíguo." },
        clarifyOptions: [
          { label: top.label, proposal: optA },
          { label: second.label, proposal: optB },
        ],
      };
    }
  }

  return buildFromIntent(top.id, state, slots, slots.amount, at, base);
}

export function parseDailyReport(text: string, state: AppState, at = state.asOf): ReportProposal[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseReportLine(line, state, at));
}

export function proposalKindLabel(p: ReportProposal): string {
  if (p.action.type === "movement") return KIND_LABEL[p.action.draft.kind as MovementKind];
  if (p.action.type === "payParty") return "Pagamento (party)";
  if (p.action.type === "collectParty") return "Cobrança (party)";
  return "—";
}
