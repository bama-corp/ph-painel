import {
  allocatablePersonal,
  buildAlerts,
  cfoMetrics,
  companyMonthOutlook,
  custodyLiquidity,
  envelopeOf,
  equity,
  liquidityByEntity,
  liquidityOf,
  liveRoveStatus,
  personalOwnLiquidity,
  receitaMes,
  despesaMes,
  roveCounts,
  roveMrr,
  partyOf,
} from "./engine";
import { ENTITY } from "./labels";
import { monthLabel } from "./money";
import type { AppState, EntityId } from "./types";
import { COMPANIES } from "./types";

type Topic =
  | "resumo"
  | "alertas"
  | "bolsos"
  | "alocavel"
  | "gastavel"
  | "patrimonio"
  | "custodia"
  | "contas"
  | "empresas"
  | "clientes"
  | "recorrentes"
  | "movimentos"
  | "fontes"
  | "declarado"
  | "mapa";

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function hasMovementVerb(text: string) {
  return /\b(emprestei|usei|gastei|paguei|recebi|cobrei|reembolsei|tirei|meti|pus|devolvi|comprei|transferi)\b/i.test(
    text,
  );
}

/** Frase que pede informação (não um movimento a propor). */
export function isInfoSeekingQuery(text: string): boolean {
  const t = text.trim();
  if (!t || hasMovementVerb(t)) return false;
  const f = fold(t);
  return (
    /^(quanto|quantos|qual|quais|como\s+estou|como\s+vai|o\s+que|mostra|listar?|diz|explica|resume|resumo|alerta|situacao|estado|mapa|ajuda)\b/.test(
      f,
    ) ||
    /\b(quanto|quantos|qual|quais|resumo|alertas?|bolsos?|alocavel|gastavel|patrimonio|custodia|empresas?|clientes?|recorrentes?|movimentos?|fontes?|declarad|mrr|equity|painel)\b/.test(
      f,
    ) ||
    /\?\s*$/.test(t)
  );
}

function scoreTopics(text: string): { topic: Topic; score: number }[] {
  const f = fold(text);
  const scores: Record<Topic, number> = {
    resumo: 0,
    alertas: 0,
    bolsos: 0,
    alocavel: 0,
    gastavel: 0,
    patrimonio: 0,
    custodia: 0,
    contas: 0,
    empresas: 0,
    clientes: 0,
    recorrentes: 0,
    movimentos: 0,
    fontes: 0,
    declarado: 0,
    mapa: 0,
  };

  const bump = (t: Topic, n: number) => {
    scores[t] += n;
  };

  if (/\b(resumo|como\s+estou|como\s+vai|situacao|estado\s+(do\s+)?painel|overview)\b/.test(f))
    bump("resumo", 10);
  if (/\b(alerta|alertas|avisos?|decis[aã]o|urgente)\b/.test(f)) bump("alertas", 10);
  if (/\b(bolsos?|envelopes?|operacional|lazer|reserva|investimento|projectos)\b/.test(f))
    bump("bolsos", 8);
  if (/\balocavel\b/.test(f) || /por\s+alocar|sem\s+bolso|meter\b/.test(f)) bump("alocavel", 10);
  if (/\bgastavel\b/.test(f) || /posso\s+gastar|quanto\s+posso\s+gastar/.test(f)) bump("gastavel", 10);
  if (/\bpatrimonio|net\s*worth|liquido\b/.test(f)) bump("patrimonio", 9);
  if (/\bcustodia\b/.test(f) || /\b(lenu|eduardo)\b/.test(f)) bump("custodia", 7);
  if (/\b(contas?|bancos?|bai|bfa|atlantico|stand|cofre)\b/.test(f)) bump("contas", 6);
  if (/\b(empresas?|pds|plural|picasso|padstation)\b/.test(f)) bump("empresas", 7);
  if (/\b(clientes?|assinantes?|mrr)\b/.test(f)) bump("clientes", 9);
  if (/\b(recorrentes?|custos?\s+planeados?|fixos?\s+mensais?)\b/.test(f)) bump("recorrentes", 9);
  if (/\b(movimentos?|ledger|registo|fluxo\s+do\s+mes)\b/.test(f)) bump("movimentos", 8);
  if (/\b(fontes?|renda|salario|income)\b/.test(f)) bump("fontes", 8);
  if (/\b(declarad[oa]|receita\s+declarada|lucro\s+declarado)\b/.test(f)) bump("declarado", 9);
  if (/\b(mapa|ajuda|o\s+que\s+posso\s+perguntar|menu)\b/.test(f)) bump("mapa", 10);

  return (Object.keys(scores) as Topic[])
    .map((topic) => ({ topic, score: scores[topic] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function formatResumo(state: AppState): string {
  const m = cfoMetrics(state);
  const mes = monthLabel(state.month);
  const alerts = buildAlerts(state).filter((a) => a.tone === "bad" || a.tone === "warn");
  const lines = [
    `Resumo do painel · ${mes}`,
    "",
    `Liquidez própria: ${fmt(m.liquidezPropria)} Kz`,
    `Gastável (operacional+lazer): ${fmt(m.gastavel)} Kz`,
    `Alocável (ainda sem bolso): ${fmt(m.alocavel)} Kz`,
    `Património líquido: ${fmt(m.patrimonioLiquido)} Kz`,
    `Custódia (não é teu): ${fmt(m.custodia)} Kz`,
    "",
    `Empresas (caixa): PDS ${fmt(liquidityByEntity(state, "cw"))} · Plural ${fmt(liquidityByEntity(state, "rove"))} · Picasso's ${fmt(liquidityByEntity(state, "picasso"))} · PH ${fmt(liquidityByEntity(state, "ph"))} Kz`,
  ];
  if (alerts.length) {
    lines.push("", `Atenção (${alerts.length}):`);
    for (const a of alerts.slice(0, 4)) lines.push(`· ${a.text}`);
  }
  return lines.join("\n") + "\n\n— Pergunta um tema: bolsos, alertas, Plural, dívidas, lucro esperado…";
}

function formatAlertas(state: AppState): string {
  const alerts = buildAlerts(state);
  if (!alerts.length) return "Alertas\n\nNenhum alerta activo neste momento.";
  const lines = alerts.map((a) => {
    const tag = a.tone === "bad" ? "vermelho" : a.tone === "warn" ? "âmbar" : "info";
    return `· [${tag}] ${a.text}`;
  });
  return `Alertas · ${alerts.length}\n\n${lines.join("\n")}`;
}

function formatBolsos(state: AppState): string {
  const rows = state.envelopes.map((e) => `· ${e.name}: ${fmt(envelopeOf(state, e.id))} Kz`);
  const aloc = allocatablePersonal(state);
  const gast = cfoMetrics(state).gastavel;
  return (
    `Bolsos (pessoal)\n\n${rows.join("\n")}\n\n` +
    `Gastável (operacional+lazer): ${fmt(gast)} Kz\n` +
    `Ainda alocável: ${fmt(aloc)} Kz` +
    (aloc > 1 ? " — usa Meter no Orçamento." : ".")
  );
}

function formatAlocavel(state: AppState): string {
  const n = allocatablePersonal(state);
  const own = personalOwnLiquidity(state);
  const nosBolsos = roundish(own - n);
  return (
    `Alocável · ${fmt(n)} Kz\n\n` +
    `Capital próprio ainda sem bolso.\n` +
    `Liquidez própria: ${fmt(own)} Kz · já nos bolsos: ~${fmt(Math.max(0, nosBolsos))} Kz.\n\n` +
    `Custódia e caixa das empresas não entram. Disponível ≠ gastável.`
  );
}

function roundish(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatGastavel(state: AppState): string {
  const m = cfoMetrics(state);
  return (
    `Gastável · ${fmt(m.gastavel)} Kz\n\n` +
    `Operacional: ${fmt(envelopeOf(state, "operacional"))} Kz · Lazer: ${fmt(envelopeOf(state, "lazer"))} Kz\n` +
    `Reserva ${fmt(m.reservado)} · Investimento ${fmt(m.investivel)} — não gastáveis no dia a dia.\n` +
    `Liquidez própria ${fmt(m.liquidezPropria)} Kz ≠ licença para gastar.`
  );
}

function formatPatrimonio(state: AppState): string {
  const m = cfoMetrics(state);
  return (
    `Património líquido · ${fmt(m.patrimonioLiquido)} Kz\n\n` +
    `Liquidez própria: ${fmt(m.liquidezPropria)} Kz\n` +
    `Participações (equity empresas): incluídas no líquido\n` +
    `Dívida própria: ${fmt(m.dividaPropria)} Kz · Custódia excluída: ${fmt(m.custodia)} Kz\n` +
    `Conta corrente à PDS: ${fmt(m.contaCorrenteProprietario)} Kz\n\n` +
    `— Visão longa; não é teto de gasto.`
  );
}

function formatCustodia(state: AppState): string {
  const total = custodyLiquidity(state);
  const parties = state.parties.filter((p) => p.ownership === "custody" && partyOf(state, p.id) > 0);
  const lines = parties.map((p) => {
    const held = p.heldInAccountId
      ? state.accounts.find((a) => a.id === p.heldInAccountId)?.name ?? p.heldInAccountId
      : "conta por marcar";
    return `· ${p.name}: ${fmt(partyOf(state, p.id))} Kz (em ${held})`;
  });
  return (
    `Custódia · ${fmt(total)} Kz\n\n` +
    (lines.length ? lines.join("\n") : "Sem custódia registada.") +
    `\n\nNão é teu — não Meter para bolsos. Devolver sai da conta marcada.`
  );
}

function formatContas(state: AppState): string {
  const accs = state.accounts.filter((a) => a.entityId === "pessoal");
  const lines = accs.map((a) => {
    const total = liquidityOf(state, a.id);
    return `· ${a.name}: ${fmt(total)} Kz`;
  });
  const own = personalOwnLiquidity(state);
  const cust = custodyLiquidity(state);
  return (
    `Contas pessoais\n\n${lines.join("\n")}\n\n` +
    `Teu (próprio): ${fmt(own)} Kz · Custódia: ${fmt(cust)} Kz · Bruto: ${fmt(own + cust)} Kz`
  );
}

function formatEmpresas(state: AppState): string {
  const mes = monthLabel(state.month);
  const blocks = COMPANIES.map((id) => {
    const o = companyMonthOutlook(state, id);
    const caixa = liquidityByEntity(state, id);
    return (
      `· ${ENTITY[id].short}: caixa ${fmt(caixa)} Kz · equity ${fmt(equity(state, id))} Kz\n` +
      `  ${mes}: receita ${fmt(o.receita)} · lucro registado ${fmt(o.lucroRegistado)} · esperado ${fmt(o.lucroEsperado)} Kz`
    );
  });
  return `Empresas\n\n${blocks.join("\n\n")}\n\n— Caixa delas não é tua para gastar.`;
}

function formatClientes(state: AppState): string {
  const counts = roveCounts(state);
  const mrr = roveMrr(state);
  const lines = [
    `Clientes Plural · MRR ${fmt(mrr)} Kz`,
    "",
    `Activos: ${counts.ativo} · Vence em breve: ${counts.vence_em_breve} · Em atraso: ${counts.em_atraso}`,
    `Suspenso: ${counts.suspenso} · Cancelado: ${counts.cancelado} · Potencial: ${counts.potencial}`,
    `Receita declarada: ${fmt(state.declared.roveRevenue)} Kz · Lucro declarado: ${fmt(state.declared.roveProfit)} Kz`,
  ];
  if (counts.em_atraso > 0) {
    const atrasados = state.roveClients
      .filter((c) => liveRoveStatus(c, state.asOf) === "em_atraso")
      .slice(0, 8);
    if (atrasados.length) {
      lines.push("", "Em atraso:");
      for (const c of atrasados) {
        lines.push(`· ${c.name} · ${fmt(c.price)} Kz · venceu ${c.nextPayment ?? "—"}`);
      }
    }
  }
  return lines.join("\n");
}

function formatRecorrentes(state: AppState): string {
  const rec = (state.recurring ?? []).filter((r) => r.active !== false);
  if (!rec.length) return "Recorrentes\n\nNenhum custo recorrente activo.";
  const byEntity = new Map<EntityId, typeof rec>();
  for (const r of rec) {
    const list = byEntity.get(r.entityId) ?? [];
    list.push(r);
    byEntity.set(r.entityId, list);
  }
  const blocks: string[] = [];
  for (const [eid, list] of byEntity) {
    const name = ENTITY[eid]?.short ?? eid;
    const sum = list.reduce((s, r) => s + r.amount, 0);
    blocks.push(
      `${name} · ${fmt(sum)} Kz\n` + list.map((r) => `· ${r.name}: ${fmt(r.amount)} Kz`).join("\n"),
    );
  }
  return `Custos recorrentes (planeados)\n\n${blocks.join("\n\n")}\n\n— Não movem caixa até registares no mês.`;
}

function formatMovimentos(state: AppState): string {
  const mes = state.month;
  const moves = state.movements.filter((m) => m.at.slice(0, 7) === mes);
  const recP = receitaMes(state, "pessoal", mes);
  const despP = despesaMes(state, "pessoal", mes);
  const byEnt = COMPANIES.map((id) => {
    const r = receitaMes(state, id, mes);
    const d = despesaMes(state, id, mes);
    return `· ${ENTITY[id].short}: +${fmt(r)} / −${fmt(d)} Kz`;
  });
  return (
    `Movimentos · ${monthLabel(mes)}\n\n` +
    `${moves.length} lançamentos no mês.\n` +
    `Pessoal: receita ${fmt(recP)} · despesa ${fmt(despP)} Kz\n` +
    byEnt.join("\n") +
    `\n\n— Detalhe em /movimentos. Diz «lucro esperado Plural» para o esperado.`
  );
}

function formatFontes(state: AppState): string {
  const src = (state.incomeSources ?? []).filter((s) => s.active !== false);
  if (!src.length) return "Fontes de renda\n\nNenhuma fonte activa.";
  const lines = src.map((s) => `· ${s.name}: ${fmt(s.amount)} Kz`);
  const sum = src.reduce((a, s) => a + s.amount, 0);
  return `Fontes de renda · ${fmt(sum)} Kz / mês\n\n${lines.join("\n")}\n\n— Plano; só o Registo move caixa.`;
}

function formatDeclarado(state: AppState): string {
  const d = state.declared;
  return (
    `Valores declarados (plano)\n\n` +
    `· Salário / renda: ${fmt(d.salary)} Kz\n` +
    `· Plural receita: ${fmt(d.roveRevenue)} Kz\n` +
    `· Plural lucro: ${fmt(d.roveProfit)} Kz\n` +
    `· PDS faturação julho: ${fmt(d.cwRevenueJuly)} Kz\n\n` +
    `MRR live (clientes): ${fmt(roveMrr(state))} Kz — pode diferir da receita declarada.`
  );
}

function formatMapa(): string {
  return [
    "O que podes perguntar",
    "",
    "· Resumo / como estou",
    "· Alertas",
    "· Bolsos, alocável, gastável, património",
    "· Contas, custódia, dívidas, a receber",
    "· Empresas, lucro esperado/registado, caixa, equity",
    "· Clientes Plural, MRR",
    "· Recorrentes, fontes, valores declarados",
    "· Movimentos do mês",
    "· Conceitos: «o que é custódia?»",
    "",
    "Para registar: diz o que aconteceu com valor — ex. «Recebi 50000 no BAI».",
  ].join("\n");
}

function renderTopic(topic: Topic, state: AppState): string {
  switch (topic) {
    case "resumo":
      return formatResumo(state);
    case "alertas":
      return formatAlertas(state);
    case "bolsos":
      return formatBolsos(state);
    case "alocavel":
      return formatAlocavel(state);
    case "gastavel":
      return formatGastavel(state);
    case "patrimonio":
      return formatPatrimonio(state);
    case "custodia":
      return formatCustodia(state);
    case "contas":
      return formatContas(state);
    case "empresas":
      return formatEmpresas(state);
    case "clientes":
      return formatClientes(state);
    case "recorrentes":
      return formatRecorrentes(state);
    case "movimentos":
      return formatMovimentos(state);
    case "fontes":
      return formatFontes(state);
    case "declarado":
      return formatDeclarado(state);
    case "mapa":
      return formatMapa();
  }
}

/**
 * Responde a perguntas de informação sobre qualquer zona do painel (estado vivo).
 * Devolve null se a frase não parecer pedido de info.
 */
export function answerPanelQuestion(text: string, state: AppState): string | null {
  const t = text.trim();
  if (!t || hasMovementVerb(t)) return null;
  if (!isInfoSeekingQuery(t) && !/\b(resumo|alertas|bolsos|alocavel|gastavel|patrimonio|mapa|ajuda)\b/i.test(t)) {
    return null;
  }

  const ranked = scoreTopics(t);
  if (ranked.length === 0) {
    // Pedido genérico de info → resumo
    if (isInfoSeekingQuery(t)) return formatResumo(state);
    return null;
  }

  const best = ranked[0]!;
  // Limiar baixo: querem cobertura ampla
  if (best.score < 5 && !isInfoSeekingQuery(t)) return null;

  // Se empatar resumo com outro, prefere o específico
  if (best.topic === "resumo" && ranked[1] && ranked[1].score >= best.score - 1) {
    return renderTopic(ranked[1].topic, state);
  }

  return renderTopic(best.topic, state);
}

/** Último recurso: nunca «Sem valor» em pergunta de info. */
export function answerPanelFallback(text: string, state: AppState): string {
  const direct = answerPanelQuestion(text, state);
  if (direct) return direct;
  return (
    formatResumo(state) +
    `\n\nNão apanhei o tema exacto de «${text.trim()}». ` +
    `Tenta: «resumo», «alertas», «bolsos», «lucro esperado Plural», «clientes», «mapa».`
  );
}
