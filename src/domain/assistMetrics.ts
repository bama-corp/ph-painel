import {
  companyMonthOutlook,
  liquidityByEntity,
  roveMrr,
} from "./engine";
import { ENTITY } from "./labels";
import { monthLabel } from "./money";
import type { AppState, EntityId } from "./types";

type CompanyId = Exclude<EntityId, "pessoal">;

type MetricKind =
  | "lucro_esperado"
  | "lucro_registado"
  | "receita"
  | "despesas"
  | "planeados"
  | "caixa"
  | "equity"
  | "mrr";

const COMPANY_ALIASES: { id: CompanyId; re: RegExp }[] = [
  { id: "rove", re: /\b(plural|rove)\b/i },
  { id: "cw", re: /\b(pds|padstation|cw)\b/i },
  { id: "picasso", re: /\b(picasso'?s?|picassos)\b/i },
  { id: "ph", re: /\b(ph|painel\s+holdings?)\b/i },
];

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function hasMovementVerb(text: string) {
  return /\b(emprestei|usei|gastei|paguei|recebi|cobrei|reembolsei|tirei|meti|pus|devolvi|comprei|transferi)\b/i.test(
    text,
  );
}

function detectCompany(text: string): CompanyId | null {
  for (const a of COMPANY_ALIASES) {
    if (a.re.test(text)) return a.id;
  }
  return null;
}

function detectMetricKind(text: string): MetricKind | null {
  const f = fold(text);
  if (/\bmrr\b/.test(f) || /receita\s+declarada/.test(f)) return "mrr";
  if (/lucro\s+esperado/.test(f)) return "lucro_esperado";
  if (/lucro\s+registado/.test(f)) return "lucro_registado";
  if (/custos?\s+planeados?|planeado\s*\(recorrentes?\)|recorrentes?/.test(f) && !/lucro/.test(f))
    return "planeados";
  if (/despesas?\s+registadas?/.test(f)) return "despesas";
  if (/\bequity\b|patrimonio\s+(da\s+)?empresa/.test(f)) return "equity";
  if (/caixa\s+actual|caixa\s+atual/.test(f)) return "caixa";
  if (/receita\s+(do\s+)?mes|receita\s+(agosto|setembro|outubro|novembro|dezembro|janeiro|fevereiro|marco|abril|maio|junho|julho)/.test(f))
    return "receita";
  if (/\breceita\b/.test(f) && !/declarada/.test(f) && (/\bmes\b/.test(f) || detectCompany(text)))
    return "receita";
  // «porque … negativo» sem KPI explícito → lucro esperado
  if (/porqu[eaê]/.test(f) && /negativ/.test(f)) return "lucro_esperado";
  if (/porqu[eaê]/.test(f) && /\blucro\b/.test(f)) return "lucro_esperado";
  return null;
}

/** Pergunta sobre KPI de empresa (sem montante de movimento). */
export function isMetricQuery(text: string): boolean {
  const t = text.trim();
  if (!t || hasMovementVerb(t)) return false;
  // Guias «como calcular…» ficam no Caderno (definition), não aqui.
  if (/como\s+(calcular|fazer|registar|definir|usar|ler)\b/i.test(t)) return false;
  return detectMetricKind(t) !== null;
}

function resolveCompany(text: string, kind: MetricKind): CompanyId {
  const named = detectCompany(text);
  if (named) return named;
  if (kind === "mrr") return "rove";
  // Sem empresa na frase: Plural (foco do plano / caso típico).
  return "rove";
}

function short(entity: CompanyId) {
  return ENTITY[entity].short;
}

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function explainLucroEsperado(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const mes = monthLabel(state.month);
  const name = short(entity);
  const base = Math.max(o.desp, o.planned);
  const title = `Lucro esperado (${name}) · ${fmt(o.lucroEsperado)} Kz`;

  const lines = [
    `Receita do mês (${mes}): ${fmt(o.receita)} Kz`,
    `Despesas registadas: ${fmt(o.desp)} Kz`,
    `Custos planeados: ${fmt(o.planned)} Kz${
      o.planned > o.desp + 0.001 ? " (acima das despesas registadas)" : ""
    }`,
    `Fórmula: receita − max(registado, planeado) → ${fmt(o.receita)} − ${fmt(base)}`,
  ];

  let cause: string;
  if (o.receita < 0.001 && o.planned > 0.001) {
    cause = `Ainda não há receita de ${mes} registada; os recorrentes (${fmt(o.planned)} Kz) já entram no esperado.`;
  } else if (o.porRegistar > 0.001) {
    cause = `Faltam ~${fmt(o.porRegistar)} Kz de custos planeados por registar — o lucro «real» ainda pode cair.`;
  } else if (o.lucroEsperado < 0) {
    cause = `A receita do mês não cobre o maior entre despesas e planeados.`;
  } else {
    cause = `Receita e custos do mês já estão alinhados no esperado.`;
  }

  return `${title}\n\n${lines.join("\n")}\n\n${cause}\n\n— Receita − max(registado, planeado).`;
}

function explainLucroRegistado(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const mes = monthLabel(state.month);
  const name = short(entity);
  const title = `Lucro registado (${name}) · ${fmt(o.lucroRegistado)} Kz`;
  const body = [
    `Receita ${mes}: ${fmt(o.receita)} Kz`,
    `Despesas registadas: ${fmt(o.desp)} Kz`,
    `Só conta o que já está no ledger (não os recorrentes por registar).`,
  ];
  let note = "";
  if (o.porRegistar > 0.001) {
    note = `\n\nAinda faltam ~${fmt(o.porRegistar)} Kz de custos planeados — o lucro esperado é ${fmt(o.lucroEsperado)} Kz.`;
  }
  return `${title}\n\n${body.join("\n")}${note}`;
}

function explainReceita(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const mes = monthLabel(state.month);
  return (
    `Receita ${mes} (${short(entity)}) · ${fmt(o.receita)} Kz\n\n` +
    `Soma das receitas no ledger deste mês. Cliente na Plural ≠ pagamento até registares a entrada.`
  );
}

function explainDespesas(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const mes = monthLabel(state.month);
  return (
    `Despesas registadas (${short(entity)}) · ${fmt(o.desp)} Kz\n\n` +
    `Só o que já foi lançado em ${mes}. Custos planeados: ${fmt(o.planned)} Kz` +
    (o.porRegistar > 0.001 ? ` — faltam ~${fmt(o.porRegistar)} Kz por registar.` : ".")
  );
}

function explainPlaneados(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const rec = (state.recurring ?? []).filter((r) => r.entityId === entity && r.active !== false);
  const list =
    rec.length > 0
      ? "\n" + rec.map((r) => `· ${r.name}: ${fmt(r.amount)} Kz`).join("\n")
      : "\n(Sem recorrentes activos.)";
  return (
    `Custos planeados (${short(entity)}) · ${fmt(o.planned)} Kz\n\n` +
    `Inventário de recorrentes — não move caixa até registares no mês.${list}\n\n` +
    `Despesas já registadas: ${fmt(o.desp)} Kz.`
  );
}

function explainCaixa(state: AppState, entity: CompanyId): string {
  const caixa = liquidityByEntity(state, entity);
  const o = companyMonthOutlook(state, entity);
  return (
    `Caixa actual (${short(entity)}) · ${fmt(caixa)} Kz\n\n` +
    `Liquidez nas contas desta empresa. Equity: ${fmt(o.equity)} Kz (caixa + a receber − a pagar + bens).`
  );
}

function explainEquity(state: AppState, entity: CompanyId): string {
  const o = companyMonthOutlook(state, entity);
  const caixa = liquidityByEntity(state, entity);
  return (
    `Equity (${short(entity)}) · ${fmt(o.equity)} Kz\n\n` +
    `Caixa actual: ${fmt(caixa)} Kz\n` +
    `Fórmula: caixa + a receber − a pagar + bens.`
  );
}

function explainMrr(state: AppState): string {
  const mrr = roveMrr(state);
  const declared = state.declared.roveRevenue;
  const gap = Math.abs(mrr - declared);
  const title = `MRR (Plural) · ${fmt(mrr)} Kz`;
  let body =
    `Soma dos preços dos clientes activos / em atraso / suspensos.\n` +
    `Receita declarada: ${fmt(declared)} Kz.`;
  if (gap > 1000) {
    body += `\n\nDiferença de ${fmt(gap)} Kz face à receita declarada — o painel alerta quando MRR ≠ declarado.`;
  } else {
    body += `\n\nAlinhado com a receita declarada (±1 000 Kz).`;
  }
  return `${title}\n\n${body}`;
}

/**
 * Explica KPIs de empresa com números do estado actual.
 * Devolve null se a frase não for pergunta de métrica.
 */
export function answerMetricQuestion(text: string, state: AppState): string | null {
  const t = text.trim();
  if (!isMetricQuery(t)) return null;
  const kind = detectMetricKind(t);
  if (!kind) return null;
  const entity = resolveCompany(t, kind);

  switch (kind) {
    case "lucro_esperado":
      return explainLucroEsperado(state, entity);
    case "lucro_registado":
      return explainLucroRegistado(state, entity);
    case "receita":
      return explainReceita(state, entity);
    case "despesas":
      return explainDespesas(state, entity);
    case "planeados":
      return explainPlaneados(state, entity);
    case "caixa":
      return explainCaixa(state, entity);
    case "equity":
      return explainEquity(state, entity);
    case "mrr":
      return explainMrr(state);
    default:
      return null;
  }
}
