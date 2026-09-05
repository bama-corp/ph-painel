import { inMonth, roundKz } from "./money";
import { COMPANIES } from "./types";
import type {
  Alert,
  AppState,
  BudgetRules,
  CostNature,
  CwCategory,
  Decision,
  Endpoint,
  EntityId,
  Movement,
  RoveProduct,
  RoveStatus,
} from "./types";

export const CW_CATS: { id: CwCategory; label: string }[] = [
  { id: "jogos", label: "Jogos" },
  { id: "impressoes", label: "Impressões" },
  { id: "copias", label: "Cópias" },
  { id: "trabalhos", label: "Trabalhos escolares" },
  { id: "manutencao", label: "Manutenção" },
  { id: "outros", label: "Outros" },
  { id: "por_classificar", label: "Por classificar" },
];

export const KIND_LABEL: Record<Movement["kind"], string> = {
  receita: "Receita",
  despesa: "Despesa",
  transferencia: "Transferência",
  interempresa: "Transferência interempresarial",
  investimento_proprietario: "Investimento do proprietário",
  emprestimo_proprietario: "Empréstimo ao proprietário",
  prolabore: "Pró-labore",
  distribuicao: "Distribuição de lucro",
  reembolso: "Reembolso / pagamento da conta corrente",
  despesa_pessoal_pela_empresa: "Despesa pessoal paga pela empresa",
  alocacao: "Alocação (bolso)",
};

const OWNER_KINDS: Movement["kind"][] = [
  "investimento_proprietario",
  "emprestimo_proprietario",
  "prolabore",
  "distribuicao",
  "reembolso",
  "despesa_pessoal_pela_empresa",
];

export function rulesOk(r: BudgetRules) {
  return roundKz(r.obrigacoes + r.reserva + r.investimento + r.despesas + r.lazer) === 100;
}

function hit(ep: Endpoint, type: Endpoint["type"], id?: string) {
  if (ep.type !== type) return false;
  if (type === "world" || type === "unallocated") return true;
  return "id" in ep && ep.id === id;
}

export function liquidityOf(state: AppState, accountId: string) {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  let n = acc.opening;
  for (const m of state.movements) {
    if (m.kind === "alocacao") continue;
    if (m.from.type === "world" && m.to.type === "world") continue;
    if (hit(m.to, "liquidity", accountId)) n += m.amount;
    if (hit(m.from, "liquidity", accountId)) n -= m.amount;
  }
  return roundKz(n);
}

export function liquidityByEntity(state: AppState, entity: EntityId) {
  return roundKz(
    state.accounts.filter((a) => a.entityId === entity).reduce((s, a) => s + liquidityOf(state, a.id), 0),
  );
}

export function envelopeOf(state: AppState, envelopeId: string) {
  let n = 0;
  for (const m of state.movements) {
    if (m.kind === "alocacao") {
      if (hit(m.to, "envelope", envelopeId)) n += m.amount;
      if (hit(m.from, "envelope", envelopeId)) n -= m.amount;
      continue;
    }
    if (m.envelopeId === envelopeId && m.kind === "despesa") n -= m.amount;
    if (m.envelopeId === envelopeId && m.kind === "investimento_proprietario") n -= m.amount;
    if (m.envelopeId === envelopeId && m.kind === "receita") n += m.amount;
  }
  return roundKz(n);
}

export function envelopesTotal(state: AppState) {
  return roundKz(state.envelopes.reduce((s, e) => s + envelopeOf(state, e.id), 0));
}

export function unallocated(state: AppState) {
  return roundKz(liquidityByEntity(state, "pessoal") - envelopesTotal(state));
}

export function partyOf(state: AppState, partyId: string) {
  const p = state.parties.find((x) => x.id === partyId);
  if (!p) return 0;
  let n = p.opening;
  const owner = partyId === "cw-divida-p" || partyId === "emanuel-cw";
  for (const m of state.movements) {
    if (hit(m.to, "party", partyId)) n += m.amount;
    if (hit(m.from, "party", partyId)) n -= m.amount;
    if (owner) {
      if (m.kind === "reembolso") n -= m.amount;
      if (m.kind === "emprestimo_proprietario" || m.kind === "despesa_pessoal_pela_empresa") n += m.amount;
    }
  }
  return roundKz(Math.max(0, n));
}

export function partiesSum(state: AppState, entity: EntityId, side: "receber" | "pagar") {
  return roundKz(
    state.parties.filter((p) => p.entityId === entity && p.side === side).reduce((s, p) => s + partyOf(state, p.id), 0),
  );
}

export function assetsOf(state: AppState, entity: EntityId) {
  return roundKz(state.assets.filter((a) => a.entityId === entity).reduce((s, a) => s + a.value, 0));
}

export function monthMoves(state: AppState, entity: EntityId, month = state.month) {
  return state.movements.filter((m) => m.entityId === entity && inMonth(m.at, month) && m.kind !== "alocacao");
}

export function receitaMes(state: AppState, entity: EntityId, month = state.month) {
  return roundKz(
    monthMoves(state, entity, month)
      .filter((m) => m.kind === "receita")
      .reduce((s, m) => s + m.amount, 0),
  );
}

export function despesaMes(state: AppState, entity: EntityId, month = state.month) {
  return roundKz(
    monthMoves(state, entity, month)
      .filter((m) => m.kind === "despesa" || m.kind === "prolabore")
      .reduce((s, m) => s + m.amount, 0),
  );
}

export function lucroMes(state: AppState, entity: EntityId, month = state.month) {
  return roundKz(receitaMes(state, entity, month) - despesaMes(state, entity, month));
}

export function cwByCategory(state: AppState, month = state.month) {
  const map: Record<CwCategory, number> = {
    jogos: 0,
    impressoes: 0,
    copias: 0,
    trabalhos: 0,
    manutencao: 0,
    outros: 0,
    por_classificar: 0,
  };
  for (const m of state.movements) {
    if (m.entityId !== "cw" || m.kind !== "receita") continue;
    if (!inMonth(m.at, month)) continue;
    const cat = m.category ?? "por_classificar";
    map[cat] += m.amount;
  }
  return map;
}

export function cwCosts(state: AppState, month = state.month) {
  const map: Record<CostNature, number> = { fixo: 0, variavel: 0, investimento: 0, retirada: 0 };
  for (const m of monthMoves(state, "cw", month)) {
    if (m.kind === "despesa" || OWNER_KINDS.includes(m.kind)) {
      const n = m.costNature ?? (OWNER_KINDS.includes(m.kind) ? "retirada" : "variavel");
      map[n] += m.amount;
    }
  }
  return map;
}

export function ownerCurrent(state: AppState) {
  return partyOf(state, "emanuel-cw");
}

export function equity(state: AppState, entity: EntityId) {
  const cash = liquidityByEntity(state, entity);
  const rec = partiesSum(state, entity, "receber");
  const pay = partiesSum(state, entity, "pagar");
  const eq = assetsOf(state, entity);
  return roundKz(cash + rec + eq - pay);
}

export function patrimonioPessoal(state: AppState) {
  const dinheiro = liquidityByEntity(state, "pessoal");
  const bens = assetsOf(state, "pessoal");
  const participacoes = roundKz(COMPANIES.reduce((s, id) => s + equity(state, id), 0));
  const dividas = partiesSum(state, "pessoal", "pagar");
  const receber = partiesSum(state, "pessoal", "receber");
  const liquido = roundKz(dinheiro + bens + participacoes + receber - dividas);
  return { dinheiro, bens, participacoes, dividas, receber, liquido };
}

export function spendable(state: AppState) {
  return roundKz(envelopeOf(state, "operacional") + envelopeOf(state, "lazer"));
}

export function liveRoveStatus(c: AppState["roveClients"][number], asOf: string): RoveStatus {
  if (c.status === "potencial" || c.status === "suspenso" || c.status === "cancelado") return c.status;
  if (!c.nextPayment) return c.status;
  const due = new Date(c.nextPayment + "T12:00:00");
  const now = new Date(asOf + "T12:00:00");
  const days = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "em_atraso";
  if (days <= 3) return "vence_em_breve";
  return "ativo";
}

export function roveCounts(state: AppState) {
  const counts: Record<RoveStatus, number> = {
    ativo: 0,
    vence_em_breve: 0,
    em_atraso: 0,
    suspenso: 0,
    cancelado: 0,
    potencial: 0,
  };
  for (const c of state.roveClients) counts[liveRoveStatus(c, state.asOf)] += 1;
  return counts;
}

export function roveMrr(state: AppState, product?: RoveProduct) {
  return roundKz(
    state.roveClients
      .filter((c) => {
        const st = liveRoveStatus(c, state.asOf);
        if (st === "potencial" || st === "cancelado") return false;
        return product ? c.product === product : true;
      })
      .reduce((s, c) => s + c.price, 0),
  );
}

export function unitEconomics(state: AppState, product: RoveProduct) {
  const clients = state.roveClients.filter((c) => {
    const st = liveRoveStatus(c, state.asOf);
    return c.product === product && st !== "potencial" && st !== "cancelado";
  });
  const receita = roundKz(clients.reduce((s, c) => s + c.price, 0));
  const n = clients.length;
  const custos = roundKz(
    state.recurring
      .filter((r) => r.entityId === "rove" && (r.product === product || r.product === "geral"))
      .reduce((s, r) => s + r.amount, 0),
  );
  const custoGeral = roundKz(
    state.recurring.filter((r) => r.entityId === "rove" && r.product === "geral").reduce((s, r) => s + r.amount, 0),
  );
  const share = n === 0 ? 0 : custos / Math.max(n, 1);
  const perClientRevenue = n === 0 ? 0 : roundKz(receita / n);
  const perClientCost = roundKz(share);
  return {
    n,
    receita,
    custos: custos === custoGeral && product ? roundKz(custos / 2) : custos,
    perClientRevenue,
    perClientCost,
    margem: roundKz(perClientRevenue - perClientCost),
  };
}

export function fluxoMes(state: AppState, month = state.month) {
  let entradas = 0;
  let despesas = 0;
  let investimentos = 0;
  let dividasPagas = 0;
  let reservado = 0;
  for (const m of state.movements) {
    if (!inMonth(m.at, month)) continue;
    if (m.kind === "receita" && m.entityId === "pessoal") entradas += m.amount;
    if (m.kind === "despesa" && m.entityId === "pessoal") despesas += m.amount;
    if (m.kind === "alocacao" && hit(m.to, "envelope", "investimento")) investimentos += m.amount;
    if (m.kind === "alocacao" && hit(m.to, "envelope", "reserva")) reservado += m.amount;
    if (m.kind === "reembolso" || (m.kind === "despesa" && m.from.type === "party")) dividasPagas += m.amount;
  }
  return {
    entradas: roundKz(entradas),
    despesas: roundKz(despesas),
    investimentos: roundKz(investimentos),
    dividasPagas: roundKz(dividasPagas),
    reservado: roundKz(reservado),
  };
}

export function buildAlerts(state: AppState): Alert[] {
  const out: Alert[] = [];
  const u = unallocated(state);
  if (u > 1) {
    out.push({
      id: "unalloc",
      tone: "bad",
      text: `${u.toLocaleString("pt-PT")} Kz pessoais sem função. Dinheiro disponível não é dinheiro para gastar.`,
      href: "/orcamento",
    });
  }
  const gsa = partyOf(state, "gsa");
  if (gsa > 0) out.push({ id: "gsa", tone: "warn", text: `GSA deve ${gsa.toLocaleString("pt-PT")} Kz.`, href: "/contas" });
  const own = ownerCurrent(state);
  if (own > 0) {
    out.push({
      id: "owner",
      tone: "warn",
      text: `Emanuel deve ${own.toLocaleString("pt-PT")} Kz à PDS (conta corrente — a PDS não perdeu este dinheiro).`,
      href: "/pds",
    });
  }
  const atraso = roveCounts(state).em_atraso;
  if (atraso > 0) {
    out.push({
      id: "rove-late",
      tone: "bad",
      text: `${atraso} cliente${atraso > 1 ? "s" : ""} Plural em atraso.`,
      href: "/plural",
    });
  }
  const cats = cwByCategory(state);
  if (cats.por_classificar > 0) {
    out.push({
      id: "cw-cat",
      tone: "warn",
      text: `PDS tem ${cats.por_classificar.toLocaleString("pt-PT")} Kz de receita por classificar. Sem isto não há margem por serviço.`,
      href: "/pds",
    });
  }
  const mrr = roveMrr(state);
  if (Math.abs(mrr - state.declared.roveRevenue) > 1000) {
    out.push({
      id: "rove-recon",
      tone: "info",
      text: `Plural MRR dos clientes (${mrr.toLocaleString("pt-PT")} Kz) ≠ receita declarada (${state.declared.roveRevenue.toLocaleString("pt-PT")} Kz).`,
      href: "/plural",
    });
  }
  const classificarBanco = liquidityOf(state, "p-classificar");
  if (classificarBanco > 1) {
    out.push({
      id: "bank",
      tone: "info",
      text: `${classificarBanco.toLocaleString("pt-PT")} Kz em «Por classificar» — diz em que conta isso vive.`,
      href: "/contas",
    });
  }
  const unknownPay = state.parties.filter(
    (p) => p.side === "pagar" && p.unknown && partyOf(state, p.id) === 0 && p.opening === 0,
  );
  if (unknownPay.length) {
    out.push({
      id: "pay-unk",
      tone: "info",
      text: `Há nomes em a pagar sem valor (${unknownPay.map((p) => p.name).join(", ")}).`,
      href: "/contas",
    });
  }
  out.push({
    id: "wall",
    tone: "info",
    text: `Empresas: PDS ${liquidityByEntity(state, "cw").toLocaleString("pt-PT")} · Plural ${liquidityByEntity(state, "rove").toLocaleString("pt-PT")} · Picasso's ${liquidityByEntity(state, "picasso").toLocaleString("pt-PT")} · PH ${liquidityByEntity(state, "ph").toLocaleString("pt-PT")} Kz. Isso não é teu para gastar.`,
  });
  const pessoalSemCat = state.movements.some(
    (m) => m.entityId === "pessoal" && m.kind === "despesa" && inMonth(m.at, state.month) && !m.envelopeId,
  );
  if (pessoalSemCat) {
    out.push({
      id: "no-env",
      tone: "warn",
      text: "Há despesas pessoais neste mês sem bolso. O sistema não sabe se veio de lazer ou de operacional.",
      href: "/movimentos",
    });
  }
  return out;
}

export function splitSalary(amount: number, rules: BudgetRules) {
  const a = roundKz((amount * rules.obrigacoes) / 100);
  const r = roundKz((amount * rules.reserva) / 100);
  const i = roundKz((amount * rules.investimento) / 100);
  const d = roundKz((amount * rules.despesas) / 100);
  const l = roundKz(amount - a - r - i - d);
  return { obrigacoes: a, reserva: r, investimento: i, despesas: d, lazer: l };
}

export function buildDecisions(state: AppState): Decision[] {
  const can = spendable(state);
  const u = unallocated(state);
  const inv = envelopeOf(state, "investimento");
  const res = envelopeOf(state, "reserva");
  const own = ownerCurrent(state);
  const pay = partiesSum(state, "pessoal", "pagar");
  const split = splitSalary(state.declared.salary, state.rules);
  const fluxo = fluxoMes(state);
  const over = fluxo.despesas > split.despesas + split.lazer && fluxo.despesas > 0;

  const gastar: Decision = {
    question: "Quanto posso gastar?",
    answer: u > 1 ? "Ainda não — há dinheiro sem função." : kzAnswer(can),
    detail:
      u > 1
        ? `Há ${u.toLocaleString("pt-PT")} Kz por alocar. O total nas contas (${liquidityByEntity(state, "pessoal").toLocaleString("pt-PT")} Kz) não é teto de gasto. Aloca primeiro.`
        : `Só operacional + lazer. Reserva e investimento estão fechados.`,
    tone: u > 1 ? "bad" : can > 0 ? "ok" : "warn",
  };

  const reservar: Decision = {
    question: "Quanto devo reservar?",
    answer: kzAnswer(split.reserva),
    detail: `Regra actual: ${state.rules.reserva}% de cada entrada. Na próxima de ${state.declared.salary.toLocaleString("pt-PT")} Kz (GSA), vão ${split.reserva.toLocaleString("pt-PT")} Kz para reserva. Hoje o bolso reserva tem ${res.toLocaleString("pt-PT")} Kz.`,
    tone: res < split.reserva ? "warn" : "ok",
  };

  const investir: Decision = {
    question: "Quanto devo investir?",
    answer: kzAnswer(split.investimento),
    detail: `Regra: ${state.rules.investimento}% da entrada. Bolso investimento: ${inv.toLocaleString("pt-PT")} Kz. Só daqui sai dinheiro para as empresas — nunca da caixa delas, nem do operacional.`,
    tone: "info",
  };

  const tuni = partyOf(state, "tuni-pag");
  const terceiros = roundKz(partyOf(state, "lenu") + partyOf(state, "eduardo-gta"));
  const divida: Decision = {
    question: "Tenho alguma dívida prioritária?",
    answer:
      own > 0
        ? `Sim — ${own.toLocaleString("pt-PT")} Kz à PDS.`
        : tuni > 0
          ? `Sim — Tuni ${tuni.toLocaleString("pt-PT")} Kz.`
          : pay > 0
            ? `Sim — ${pay.toLocaleString("pt-PT")} Kz a pagar.`
            : "Nenhuma dívida pessoal em aberto.",
    detail:
      own > 0
        ? "A conta corrente do proprietário é estrutural: devolver à PDS é repor o capital da empresa, não é um favor."
        : tuni > 0
          ? `Tuni é a dívida pessoal activa. Lenu + Eduardo (GTA) são ${terceiros.toLocaleString("pt-PT")} Kz de terceiros na tua liquidez — não são dívida tua a juros, mas não são teus.`
          : "Confirma os nomes em a pagar.",
    tone: own > 0 || tuni > 0 ? "warn" : "info",
  };

  const podeCw: Decision = {
    question: "Posso investir na PDS?",
    answer: u > 1 ? "Ainda não." : inv > 0 && own >= 0 ? "Só com o bolso investimento, e depois de regras." : "Não com o que está alocado hoje.",
    detail:
      own > 0
        ? `Antes de meter mais capital: deves ${own.toLocaleString("pt-PT")} Kz à PDS. Devolver não é investimento — é reembolso. Infraestrutura (500 mil) só depois de classificar a receita de julho.`
        : "Investimento do proprietário ≠ empréstimo ≠ pró-labore. O movimento tem de escolher o tipo.",
    tone: own > 0 ? "warn" : "info",
  };

  const podeRove: Decision = {
    question: "Posso colocar dinheiro na Plural?",
    answer: u > 1 ? "Ainda não." : inv > 0 ? "Sim, como investimento do proprietário — não como despesa pessoal." : "Não: bolso investimento vazio.",
    detail: "Produto IPTV ainda sem qualidade fechada. Capital novo deve ir para estabilidade e cobrança, não para captação dos 7 potenciais.",
    tone: "info",
  };

  const acima: Decision = {
    question: "Estou a gastar acima do planeado?",
    answer: fluxo.despesas === 0 ? "Ainda não há despesas pessoais neste mês." : over ? "Sim." : "Não, dentro das regras.",
    detail: `Despesas pessoais do mês: ${fluxo.despesas.toLocaleString("pt-PT")} Kz. Tecto de despesas+lazer sobre o salário GSA: ${(split.despesas + split.lazer).toLocaleString("pt-PT")} Kz.`,
    tone: over ? "bad" : "ok",
  };

  return [gastar, reservar, investir, divida, podeCw, podeRove, acima];
}

function kzAnswer(n: number) {
  return `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

export function cwJulyUnclassified(state: AppState) {
  return roundKz(
    state.movements
      .filter((m) => m.entityId === "cw" && m.kind === "receita" && inMonth(m.at, "2026-07"))
      .reduce((s, m) => s + m.amount, 0),
  );
}
