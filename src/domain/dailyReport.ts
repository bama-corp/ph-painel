/**
 * Assistente de relatório do dia — interpreta frases em PT e propõe movimentos PH.
 * Não aplica sozinho: a UI confirma antes de gravar no ledger.
 */
import { KIND_LABEL, liquidityOf, partyOf } from "./engine";
import { entityShort } from "./labels";
import type { AppState, EntityId, Movement, MovementKind, Party } from "./types";
import { roundKz } from "./money";

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
};

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
]);

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Extrai valor em Kz: 2000 · 2.000 · 2 000 · 2.000,50 · 2000kz */
export function parseAmountKz(text: string): number | null {
  const m = text.match(
    /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:kz|kz\.|kwanzas?)?/i,
  );
  if (!m) return null;
  const intPart = m[1].replace(/[.\s]/g, "");
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

function isCustodyReleaseVerb(text: string) {
  return /\b(emprestei|usei|tirei|saquei|retirei|devolvi|entreguei|libertei|paguei|pago)\b/i.test(
    text,
  );
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
      if (lower.includes(t)) score += t.length >= 4 ? 3 : 1;
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
  | { type: "orphan_fix"; text: string };

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
        // Empréstimo: «na caixa» / «pessoal» costuma ser o destino; «na PDS» a origem.
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
  });
  return {
    proposal,
    tip: tips.join("; "),
  };
}

/**
 * Uma mensagem do chat: confirma, cancela, corrige a pendente, ou interpreta frase nova.
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

  if (pending) {
    if (isAffirmative(trimmed)) return { type: "confirm" };
    if (isNegative(trimmed)) return { type: "skip" };
    const revised = reviseProposal(pending, trimmed, state, at);
    if (revised) return { type: "revise", proposal: revised.proposal, tip: revised.tip };

    // Mesma conta / sem mudança útil
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

    // Correcção sem valor/conta reconhecível — não tratar como frase nova se for curta
    const looksLikeCorrection =
      !parseAmountKz(trimmed) &&
      trimmed.split(/\s+/).length <= 12 &&
      !/\b(emprestei|recebi|gastei|paguei|cobrei|reembolsei)\b/i.test(trimmed);
    if (looksLikeCorrection) {
      return {
        type: "orphan_fix",
        text: "Não percebi a correcção. Diz por exemplo «na caixa pessoal», «no BAI», «foi 25000» ou «sim» / «não».",
      };
    }
  } else {
    // Sem pendente: «na caixa» sozinho
    if (!parseAmountKz(trimmed) && detectAccount(state, trimmed)) {
      return {
        type: "orphan_fix",
        text: "Não há proposta a corrigir. Diz primeiro o que aconteceu, com valor — depois podes ajustar a conta.",
      };
    }
  }

  return { type: "fresh", proposal: parseReportLine(trimmed, state, at) };
}

/**
 * Interpreta uma linha do relatório.
 * Ex.: «Emprestei 2000kz na PDS» → empréstimo ao proprietário (PDS → pessoal).
 * Ex.: «Emprestei 30000 do Lenu em custódia» → pagamento/libertação de custódia.
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

  const amount = parseAmountKz(trimmed);
  if (!amount) {
    return {
      ...base,
      summary: "Sem valor",
      detail: "Não encontrei um montante em Kz nesta linha.",
      confidence: "low",
      action: { type: "unknown", reason: "Sem montante." },
    };
  }

  const entity = detectEntity(trimmed);
  const party = findParty(state, trimmed);
  const custodyTalk = mentionsCustody(trimmed);
  const releaseVerb = isCustodyReleaseVerb(trimmed);

  // —— Custódia / dinheiro de terceiro (antes de «emprestei na PDS») ——
  // «Emprestei os 30000kz do Eliandro que estavam em custodia»
  // «Devolvi 30000 da custódia do Lenu»
  // «Tirei 10 mil do Lenu»
  if (
    releaseVerb &&
    (custodyTalk ||
      (party && (party.ownership === "custody" || /\b(do|da|de)\s+/i.test(trimmed)))) &&
    entity === "pessoal"
  ) {
    if (!party) {
      const hinted = hintedPersonName(trimmed);
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

    const prefer = preferAccountsFromText(state, trimmed, party.entityId, [
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
      held ??
      pickAccount(state, party.entityId, prefer) ??
      pickAccount(state, "pessoal", prefer)!;
    const labeled = withLabels(state, {
      ...base,
      confidence: custodyTalk || party.ownership === "custody" ? "high" : "medium",
      action: {
        type: "payParty",
        partyId: party.id,
        accountId,
        amount,
        at,
        note: trimmed,
      },
      summary: "",
      detail: "",
    });
    return labeled;
  }

  // —— Empréstimo ao proprietário (tirei / emprestei da empresa) ——
  // «Emprestei 2000kz na PDS» / «Tirei 5 mil da PDS»
  if (
    /\b(emprestei|empréstimo|emprestimo|tirei|saquei|retirei)\b/i.test(trimmed) &&
    entity !== "pessoal"
  ) {
    const fromPrefer = preferAccountsFromText(
      state,
      trimmed,
      entity,
      entity === "cw" ? ["cw-caixa", "cw-bai2"] : [],
    );
    const toPrefer = preferAccountsFromText(state, trimmed, "pessoal", [
      "caixa-p",
      "bai",
      "bfa",
    ]);
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
      note: trimmed,
    };
    return withLabels(state, {
      ...base,
      confidence: "high",
      action: { type: "movement", draft },
      summary: "",
      detail: "",
    });
  }

  // —— Reembolso à empresa ——
  if (/\b(reembolsei|devolvi|paguei\s+à\s+pds|paguei\s+a\s+pds)\b/i.test(trimmed) && entity !== "pessoal") {
    const fromId = pickAccount(state, "pessoal", ["bai", "caixa-p"]);
    const toId = pickAccount(state, entity, entity === "cw" ? ["cw-caixa", "cw-bai2"] : []);
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
      note: trimmed,
    };
    return {
      ...base,
      summary: `Reembolso à ${entityShort(entity)} · ${amount.toLocaleString("pt-PT")} Kz`,
      detail: `Pessoal «${accountLabel(state, fromId)}» → ${entityShort(entity)} «${accountLabel(state, toId)}».`,
      confidence: "high",
      action: { type: "movement", draft },
    };
  }

  // —— Pagamento / cobrança de party ——
  if (party && /\b(paguei|pago|pagamento)\b/i.test(trimmed) && party.side === "pagar") {
    const prefer = preferAccountsFromText(state, trimmed, party.entityId, [
      "bai",
      "caixa-p",
    ]);
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
        note: trimmed,
      },
      summary: "",
      detail: "",
    });
  }

  if (party && /\b(cobrei|recebi\s+de|cobrança|cobranca)\b/i.test(trimmed) && party.side === "receber") {
    const prefer = preferAccountsFromText(state, trimmed, party.entityId, ["bai", "caixa-p"]);
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
        note: trimmed,
      },
      summary: "",
      detail: "",
    });
  }

  // —— Receita ——
  if (/\b(recebi|entrou|receita|venda|faturei|cobrança\s+loja)\b/i.test(trimmed)) {
    const ent0 = entity === "pessoal" ? "pessoal" : entity;
    const prefer = preferAccountsFromText(
      state,
      trimmed,
      ent0,
      ent0 === "cw" ? ["cw-caixa", "cw-bai2"] : ent0 === "pessoal" ? ["bai", "caixa-p"] : [],
    );
    const dest = pickAccount(state, ent0, prefer);
    if (!dest) {
      return {
        ...base,
        summary: "Receita — sem conta",
        detail: "Não há conta de destino.",
        confidence: "low",
        action: { type: "unknown", reason: "Sem conta." },
      };
    }
    const ent = state.accounts.find((a) => a.id === dest)!.entityId;
    const draft: Omit<Movement, "id"> = {
      at,
      kind: "receita",
      amount,
      from: { type: "world" },
      to: { type: "liquidity", id: dest },
      entityId: ent,
      category: ent === "cw" ? "por_classificar" : undefined,
      note: trimmed,
    };
    return withLabels(state, {
      ...base,
      confidence: /\breceita|recebi|entrou\b/i.test(trimmed) ? "high" : "medium",
      action: { type: "movement", draft },
      summary: "",
      detail: "",
    });
  }

  // —— Despesa ——
  if (/\b(gastei|paguei|despesa|comprei|saída|saida)\b/i.test(trimmed)) {
    const ent = entity;
    const prefer = preferAccountsFromText(
      state,
      trimmed,
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
      note: trimmed,
    };
    return withLabels(state, {
      ...base,
      confidence: "medium",
      action: { type: "movement", draft },
      summary: "",
      detail: "",
    });
  }

  // —— Fallback: entidade empresa + valor → despesa empresa ——
  if (entity !== "pessoal") {
    const fromId = pickAccount(state, entity, entity === "cw" ? ["cw-caixa", "cw-bai2"] : []);
    if (fromId) {
      const draft: Omit<Movement, "id"> = {
        at,
        kind: "despesa",
        amount,
        from: { type: "liquidity", id: fromId },
        to: { type: "world" },
        entityId: entity,
        costNature: "variavel",
        note: trimmed,
      };
      return {
        ...base,
        summary: `Despesa (inferida) · ${entityShort(entity)}`,
        detail: `Não reconheci o verbo — tratei como despesa de «${accountLabel(state, fromId)}». Revê antes de gravar.`,
        confidence: "low",
        action: { type: "movement", draft },
      };
    }
  }

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
