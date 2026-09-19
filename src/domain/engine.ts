import { inMonth, roundKz } from "./money";
import { COMPANIES } from "./types";
import type {
  Alert,
  AppState,
  BudgetBucket,
  BudgetRules,
  CostNature,
  CwCategory,
  Decision,
  Endpoint,
  EntityId,
  Movement,
  OwnershipClass,
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
  ajuste: "Ajuste auditado",
  pagamento_party: "Pagamento a party (dívida)",
  cobranca_party: "Cobrança de party (a receber)",
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
    // Receita NÃO credita bolsos — só alocacao (Meter). Evita inventar spendable sem cash.
  }
  return roundKz(n);
}

export function envelopesTotal(state: AppState) {
  return roundKz(state.envelopes.reduce((s, e) => s + envelopeOf(state, e.id), 0));
}

/** Gasto do mês neste bolso (despesas + investimento do proprietário). */
export function envelopeSpentMes(state: AppState, envelopeId: string, month = state.month) {
  return roundKz(
    state.movements
      .filter(
        (m) =>
          m.envelopeId === envelopeId &&
          inMonth(m.at, month) &&
          (m.kind === "despesa" || m.kind === "investimento_proprietario"),
      )
      .reduce((s, m) => s + m.amount, 0),
  );
}

// —— Ownership & métricas fundamentais (LIQUIDITY ≠ ALLOCATABLE ≠ SPENDABLE ≠ NET WORTH) ——

/** Liquidez física em contas pessoais (inclui custódia misturada nos bancos). */
export function personalGrossLiquidity(state: AppState) {
  return liquidityByEntity(state, "pessoal");
}

/** Valor de terceiros sob custódia (parties ownership=custody). */
export function custodyLiquidity(state: AppState) {
  return roundKz(
    state.parties
      .filter((p) => p.ownership === "custody")
      .reduce((s, p) => s + partyOf(state, p.id), 0),
  );
}

/** Custódia atribuída a uma conta concreta (heldInAccountId). */
export function custodyInAccount(state: AppState, accountId: string) {
  return roundKz(
    state.parties
      .filter((p) => p.ownership === "custody" && p.heldInAccountId === accountId)
      .reduce((s, p) => s + partyOf(state, p.id), 0),
  );
}

/**
 * Fatia própria numa conta = saldo − custódia marcada nessa conta.
 * Se a custódia atribuída for maior que o saldo, o «teu» fica 0 (precisa reconciliar).
 */
export function ownLiquidityOf(state: AppState, accountId: string) {
  return roundKz(Math.max(0, liquidityOf(state, accountId) - custodyInAccount(state, accountId)));
}

/** Liquidez pessoal própria = bruto − custódia. */
export function personalOwnLiquidity(state: AppState) {
  return roundKz(Math.max(0, personalGrossLiquidity(state) - custodyLiquidity(state)));
}

/** Liquidez de todas as empresas. */
export function companyLiquidity(state: AppState) {
  return roundKz(COMPANIES.reduce((s, id) => s + liquidityByEntity(state, id), 0));
}

/** Capital pessoal já nos bolsos. */
export function allocatedPersonal(state: AppState) {
  return envelopesTotal(state);
}

/**
 * Capital pessoal próprio ainda sem função.
 * Nunca inclui custody nem company.
 */
export function allocatablePersonal(state: AppState) {
  return roundKz(Math.max(0, personalOwnLiquidity(state) - allocatedPersonal(state)));
}

/**
 * Gastável = operacional + lazer.
 * Só faz sentido sobre capital já alocado a esses bolsos (próprio por invariante).
 */
export function spendablePersonal(state: AppState) {
  return roundKz(envelopeOf(state, "operacional") + envelopeOf(state, "lazer"));
}

/** @deprecated Use allocatablePersonal — mantido como alias seguro. */
export function unallocated(state: AppState) {
  return allocatablePersonal(state);
}

export function partyOf(state: AppState, partyId: string) {
  const p = state.parties.find((x) => x.id === partyId);
  if (!p) return 0;
  let n = p.opening;
  const owner = p.role === "owner_current" || partyId === "cw-divida-p" || partyId === "emanuel-cw";
  for (const m of state.movements) {
    if (m.kind === "pagamento_party" || m.kind === "cobranca_party") {
      // Operação atómica: reduz o saldo da party (dívida ou a receber).
      if (hit(m.to, "party", partyId) || hit(m.from, "party", partyId)) n -= m.amount;
      continue;
    }
    if (hit(m.to, "party", partyId)) n += m.amount;
    if (hit(m.from, "party", partyId)) n -= m.amount;
    if (owner) {
      if (m.kind === "reembolso") n -= m.amount;
      if (m.kind === "emprestimo_proprietario" || m.kind === "despesa_pessoal_pela_empresa") n += m.amount;
    }
  }
  return roundKz(Math.max(0, n));
}

export function partiesSum(
  state: AppState,
  entity: EntityId,
  side: "receber" | "pagar",
  ownership?: OwnershipClass,
) {
  return roundKz(
    state.parties
      .filter(
        (p) =>
          p.entityId === entity &&
          p.side === side &&
          (ownership === undefined || p.ownership === ownership),
      )
      .reduce((s, p) => s + partyOf(state, p.id), 0),
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
  const p = state.parties.find((x) => x.role === "owner_current");
  return p ? partyOf(state, p.id) : partyOf(state, "emanuel-cw");
}

/** Conta corrente do proprietário nesta empresa (0 se não existir party). */
export function ownerCurrentFor(state: AppState, entity: EntityId) {
  const p = state.parties.find((x) => x.role === "owner_current" && x.entityId === entity);
  return p ? partyOf(state, p.id) : 0;
}

export function equity(state: AppState, entity: EntityId) {
  const cash = liquidityByEntity(state, entity);
  const rec = partiesSum(state, entity, "receber");
  const pay = partiesSum(state, entity, "pagar");
  const eq = assetsOf(state, entity);
  return roundKz(cash + rec + eq - pay);
}

/** Custos recorrentes activos desta empresa (planeamento mensal). */
export function recurringOf(state: AppState, entity: EntityId) {
  return (state.recurring ?? []).filter((r) => r.entityId === entity && r.active !== false);
}

export function recurringPlanned(state: AppState, entity: EntityId) {
  return roundKz(recurringOf(state, entity).reduce((s, r) => s + r.amount, 0));
}

/**
 * Visão do mês: registado vs planeado.
 * lucroEsperado = receita − max(despesas registadas, custos planeados) —
 * se ainda não registaste o fixo, o lucro “real” engana para cima.
 */
export function companyMonthOutlook(state: AppState, entity: EntityId, month = state.month) {
  const receita = receitaMes(state, entity, month);
  const desp = despesaMes(state, entity, month);
  const planned = recurringPlanned(state, entity);
  const lucroRegistado = lucroMes(state, entity, month);
  const baseCusto = Math.max(desp, planned);
  const lucroEsperado = roundKz(receita - baseCusto);
  const porRegistar = roundKz(Math.max(0, planned - desp));
  return {
    receita,
    desp,
    planned,
    lucroRegistado,
    lucroEsperado,
    porRegistar,
    equity: equity(state, entity),
    ownerDue: ownerCurrentFor(state, entity),
  };
}

export function patrimonioPessoal(state: AppState) {
  const dinheiro = personalGrossLiquidity(state);
  const proprio = personalOwnLiquidity(state);
  const custodia = custodyLiquidity(state);
  const bens = assetsOf(state, "pessoal");
  const participacoes = roundKz(COMPANIES.reduce((s, id) => s + equity(state, id), 0));
  const dividasOwn = partiesSum(state, "pessoal", "pagar", "own");
  const dividas = partiesSum(state, "pessoal", "pagar");
  const receber = partiesSum(state, "pessoal", "receber", "own");
  /** Empréstimo empresa→proprietário: cash pessoal sobe, mas owner_current (a receber na empresa) é dívida do dono. */
  const dividaOwnerEmpresa = ownerCurrent(state);
  /** Património líquido próprio — custódia fora (nem no dinheiro nem nas «dívidas»). */
  const liquido = roundKz(proprio + bens + participacoes + receber - dividasOwn - dividaOwnerEmpresa);
  return {
    dinheiro,
    proprio,
    custodia,
    bens,
    participacoes,
    dividas,
    dividasOwn,
    receber,
    dividaOwnerEmpresa,
    liquido,
  };
}

/** Net worth — não é gastável. */
export function netWorth(state: AppState) {
  return patrimonioPessoal(state).liquido;
}

export function spendable(state: AppState) {
  return spendablePersonal(state);
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
      .filter(
        (r) =>
          r.entityId === "rove" &&
          r.active !== false &&
          (r.product === product || r.product === "geral"),
      )
      .reduce((s, r) => s + r.amount, 0),
  );
  const custoGeral = roundKz(
    state.recurring
      .filter((r) => r.entityId === "rove" && r.active !== false && r.product === "geral")
      .reduce((s, r) => s + r.amount, 0),
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
  let transferencias = 0;
  let investimentos = 0;
  let dividasPagas = 0;
  let interempresa = 0;
  let cobrancas = 0;
  let reservado = 0;
  let alocadoInvestimento = 0;

  for (const m of state.movements) {
    if (!inMonth(m.at, month)) continue;

    if (m.kind === "receita" && m.entityId === "pessoal") entradas += m.amount;
    if (m.kind === "cobranca_party" && m.entityId === "pessoal") cobrancas += m.amount;
    if (m.kind === "despesa" && m.entityId === "pessoal") despesas += m.amount;
    if (m.kind === "transferencia" && m.entityId === "pessoal") transferencias += m.amount;
    if (m.kind === "investimento_proprietario") investimentos += m.amount;
    if (m.kind === "pagamento_party" && m.entityId === "pessoal") dividasPagas += m.amount;
    if (m.kind === "reembolso") dividasPagas += m.amount;
    if (m.kind === "interempresa") interempresa += m.amount;
    if (m.kind === "alocacao" && hit(m.to, "envelope", "investimento")) alocadoInvestimento += m.amount;
    if (m.kind === "alocacao" && hit(m.to, "envelope", "reserva")) reservado += m.amount;
  }

  return {
    /** Entradas reais do mês (movimentos), não o salário declarado. */
    entradas: roundKz(entradas),
    despesas: roundKz(despesas),
    transferencias: roundKz(transferencias),
    investimentos: roundKz(investimentos),
    dividasPagas: roundKz(dividasPagas),
    interempresa: roundKz(interempresa),
    cobrancas: roundKz(cobrancas),
    reservado: roundKz(reservado),
    alocadoInvestimento: roundKz(alocadoInvestimento),
    /** Salário GSA declarado — referência de planeamento, não substituto das entradas. */
    salarioDeclarado: state.declared.salary,
  };
}

/** Métricas saneadas para o CFO — nunca misturar bruto / custody / net worth com gastável. */
export function cfoMetrics(state: AppState) {
  return {
    gastavel: spendablePersonal(state),
    reservado: envelopeOf(state, "reserva"),
    investivel: envelopeOf(state, "investimento"),
    alocavel: allocatablePersonal(state),
    custodia: custodyLiquidity(state),
    dividaPropria: partiesSum(state, "pessoal", "pagar", "own"),
    dividaTerceiros: partiesSum(state, "pessoal", "pagar", "custody"),
    empresa: companyLiquidity(state),
    contaCorrenteProprietario: ownerCurrent(state),
    liquidezPropria: personalOwnLiquidity(state),
    liquidezBrutaPessoal: personalGrossLiquidity(state),
    patrimonioLiquido: netWorth(state),
  };
}

export function buildAlerts(state: AppState): Alert[] {
  const out: Alert[] = [];
  const u = unallocated(state);
  if (u > 1) {
    out.push({
      id: "unalloc",
      tone: "bad",
      text: `${u.toLocaleString("pt-PT")} Kz alocáveis (capital próprio). Custódia e empresa excluídos — disponível ≠ gastável.`,
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

/** Soma das fontes de renda pessoais activas (planeamento mensal). */
export function plannedIncomeTotal(state: AppState) {
  return roundKz(
    (state.incomeSources ?? []).filter((s) => s.active).reduce((sum, s) => sum + s.amount, 0),
  );
}

/** Linhas activas de uma categoria orçamentária. */
export function budgetLinesOf(state: AppState, bucket: BudgetBucket) {
  return (state.budgetLines ?? []).filter((l) => l.bucket === bucket && l.active);
}

/** Soma planeada das linhas activas numa categoria. */
export function budgetLinesTotal(state: AppState, bucket: BudgetBucket) {
  return roundKz(budgetLinesOf(state, bucket).reduce((sum, l) => sum + l.amount, 0));
}

/**
 * Compara inventário (linhas) vs tecto da % × renda planeada.
 * gap > 0 → linhas acima do tecto; gap < 0 → ainda há margem.
 */
export function budgetBucketGap(
  state: AppState,
  bucket: BudgetBucket,
  rules: BudgetRules = state.rules,
) {
  const ceiling = splitSalary(plannedIncomeTotal(state), rules)[bucket];
  const planned = budgetLinesTotal(state, bucket);
  return {
    planned,
    ceiling,
    gap: roundKz(planned - ceiling),
    hasLines: budgetLinesOf(state, bucket).length > 0,
  };
}

/** Mantém declared.salary = plannedIncomeTotal (compat). */
export function syncDeclaredSalary(state: AppState): AppState {
  const total = plannedIncomeTotal(state);
  if (state.declared.salary === total) return state;
  return { ...state, declared: { ...state.declared, salary: total } };
}

/** Partes de alocação a partir das BudgetRules guardadas (não draft de UI). */
export function partsFromRules(amount: number, rules: BudgetRules) {
  const s = splitSalary(amount, rules);
  return [
    { envelopeId: "operacional", amount: roundKz(s.obrigacoes + s.despesas) },
    { envelopeId: "reserva", amount: s.reserva },
    { envelopeId: "investimento", amount: s.investimento },
    { envelopeId: "lazer", amount: s.lazer },
  ].filter((p) => p.amount > 0);
}

export type AllocateResult =
  | { ok: true; state: AppState }
  | { ok: false; reason: string; state: AppState };

/**
 * Aloca apenas a partir de allocatablePersonal.
 * Nunca usa custody nem company.
 */
export function applyAllocate(
  state: AppState,
  parts: { envelopeId: string; amount: number }[],
  opts?: { at?: string; idPrefix?: string },
): AllocateResult {
  const cleaned = parts
    .map((p) => ({ envelopeId: p.envelopeId, amount: roundKz(p.amount) }))
    .filter((p) => p.amount > 0);

  if (cleaned.length === 0) {
    return { ok: false, reason: "Nada para alocar.", state };
  }

  for (const p of cleaned) {
    if (!state.envelopes.some((e) => e.id === p.envelopeId)) {
      return { ok: false, reason: `Bolso desconhecido: ${p.envelopeId}`, state };
    }
  }

  const total = roundKz(cleaned.reduce((s, p) => s + p.amount, 0));
  const avail = allocatablePersonal(state);
  if (total > avail + 0.001) {
    return {
      ok: false,
      reason: `Só há ${avail.toLocaleString("pt-PT")} Kz alocáveis (capital pessoal próprio). Custódia e empresa excluídos.`,
      state,
    };
  }

  const at = opts?.at ?? state.asOf;
  const prefix = opts?.idPrefix ?? "a";
  const extra: Movement[] = cleaned.map((p, i) => ({
    id: `${prefix}_${i}_${Date.now().toString(36)}`,
    at,
    kind: "alocacao" as const,
    amount: p.amount,
    from: { type: "unallocated" as const },
    to: { type: "envelope" as const, id: p.envelopeId },
    entityId: "pessoal" as const,
    envelopeId: p.envelopeId,
    note: "Alocação de bolso",
  }));

  return { ok: true, state: { ...state, movements: [...extra, ...state.movements] } };
}

/**
 * Distribui uma entrada de N Kz pelas regras já guardadas em state.rules.
 * Não distribui o stock inteiro — só o valor da entrada (≤ allocatablePersonal).
 */
export function applyDistributeEntry(
  state: AppState,
  entryAmount: number,
  opts?: { at?: string },
): AllocateResult {
  if (!rulesOk(state.rules)) {
    return { ok: false, reason: "Regras guardadas inválidas (soma ≠ 100%).", state };
  }
  const amount = roundKz(entryAmount);
  if (!(amount > 0)) {
    return { ok: false, reason: "Indica o valor da entrada a distribuir.", state };
  }
  const avail = allocatablePersonal(state);
  if (amount > avail + 0.001) {
    return {
      ok: false,
      reason: `Entrada ${amount.toLocaleString("pt-PT")} Kz > alocável ${avail.toLocaleString("pt-PT")} Kz.`,
      state,
    };
  }
  return applyAllocate(state, partsFromRules(amount, state.rules), opts);
}

export type MovementResult =
  | { ok: true; state: AppState; movement: Movement }
  | { ok: false; reason: string; state: AppState };

function accountEntity(state: AppState, ep: Endpoint): EntityId | null {
  if (ep.type !== "liquidity") return null;
  return state.accounts.find((a) => a.id === ep.id)?.entityId ?? null;
}

/**
 * Invariantes de movimento no domínio (não só UI).
 * transferencia => mesma entidade; cross-entity exige kind apropriado.
 */
export function validateMovement(state: AppState, m: Omit<Movement, "id"> | Movement): string | null {
  if (!(m.amount > 0)) return "Valor inválido.";

  // C2: alocação só via applyAllocate / Meter (tecto allocatable).
  if (m.kind === "alocacao") {
    return "Alocação só pelo Meter / applyAllocate — não via movimento livre.";
  }

  // C3/C4: parties só pelos kinds atómicos.
  if (m.kind !== "pagamento_party" && m.kind !== "cobranca_party") {
    if (m.from.type === "party" || m.to.type === "party") {
      return "Parties só via pagamento_party / cobranca_party (atómicos com caixa).";
    }
  }

  // C1: receita nunca aloca a bolsos — cash → liquidez, função → Meter/applyAllocate.
  if (m.kind === "receita") {
    if (m.envelopeId) {
      return "Receita não aloca a bolsos. Credita liquidez e usa Meter / alocação.";
    }
    if (m.to.type === "envelope" || m.from.type === "envelope") {
      return "Receita não mexe em bolsos. Usa alocação.";
    }
    // C7: receita same-entity (world→liquidez OK; liquidez só da própria entidade).
    if (m.from.type === "liquidity") {
      const fromE = accountEntity(state, m.from);
      if (!fromE) return "Conta de origem inválida.";
      if (fromE !== m.entityId) {
        return "Receita cross-entity rejeitada. Usa empréstimo, pró-labore, distribuição ou reembolso.";
      }
    }
    if (m.to.type === "liquidity") {
      const toE = accountEntity(state, m.to);
      if (!toE) return "Conta de destino inválida.";
      if (toE !== m.entityId) {
        return "Receita cross-entity rejeitada. Usa empréstimo, pró-labore, distribuição ou reembolso.";
      }
    }
  }

  if (m.kind === "ajuste") {
    // Ajuste auditado: só world ↔ liquidez (postLiquidityAdjustment).
    const okPair =
      (m.from.type === "world" && m.to.type === "liquidity") ||
      (m.from.type === "liquidity" && m.to.type === "world");
    if (!okPair) {
      return "Ajuste só entre world e liquidez. Parties: pagamento/cobrança; bolsos: Meter.";
    }
  }

  // C6 + owner kinds: from/to liquidez obrigatórios (sem inventar cash via party).
  if (OWNER_KINDS.includes(m.kind)) {
    if (m.from.type !== "liquidity" || m.to.type !== "liquidity") {
      return `${KIND_LABEL[m.kind]} exige duas contas de liquidez.`;
    }
    const fromE = accountEntity(state, m.from);
    const toE = accountEntity(state, m.to);
    if (!fromE || !toE) return "Contas inválidas.";
    if (fromE === toE) {
      return `${KIND_LABEL[m.kind]} tem de cruzar entidades (empresa ↔ pessoal).`;
    }
  }

  if (m.kind === "transferencia") {
    if (m.from.type !== "liquidity" || m.to.type !== "liquidity") {
      return "Transferência exige duas contas de liquidez.";
    }
    const fromE = accountEntity(state, m.from);
    const toE = accountEntity(state, m.to);
    if (!fromE || !toE) return "Contas de transferência inválidas.";
    if (fromE !== toE) {
      return "Transferência cross-entity rejeitada. Usa interempresa, investimento_proprietario, empréstimo, reembolso, pró-labore ou distribuição.";
    }
    if (m.entityId !== fromE) {
      return "A entidade do movimento deve coincidir com a das contas.";
    }
    if (m.from.id === m.to.id) return "Origem e destino iguais.";
  }

  if (m.kind === "interempresa") {
    if (m.from.type !== "liquidity" || m.to.type !== "liquidity") {
      return "Interempresa exige duas contas de liquidez.";
    }
    const fromE = accountEntity(state, m.from);
    const toE = accountEntity(state, m.to);
    if (!fromE || !toE) return "Contas inválidas.";
    if (fromE === toE) return "Interempresa tem de cruzar duas entidades diferentes.";
  }

  if (m.kind === "despesa" && m.entityId === "pessoal") {
    if (!m.envelopeId) return "Despesa pessoal exige bolso.";
    const bal = envelopeOf(state, m.envelopeId);
    if (bal + 0.001 < m.amount) {
      return `Bolso «${m.envelopeId}» insuficiente (${bal.toLocaleString("pt-PT")} Kz). Financia o bolso antes — saldo negativo silencioso bloqueado.`;
    }
  }

  if (m.kind === "investimento_proprietario") {
    if (m.envelopeId && m.envelopeId !== "investimento") {
      return "Investimento do proprietário deve sair do bolso investimento.";
    }
    const env = m.envelopeId ?? "investimento";
    const bal = envelopeOf(state, env);
    if (bal + 0.001 < m.amount) {
      return `Bolso investimento insuficiente (${bal.toLocaleString("pt-PT")} Kz).`;
    }
  }

  if (m.kind === "pagamento_party") {
    if (m.from.type !== "liquidity" || m.to.type !== "party") {
      return "Pagamento de party: saída de liquidez → party.";
    }
    const partyId = m.to.id;
    const party = state.parties.find((p) => p.id === partyId);
    if (!party) return "Party inexistente.";
    if (party.side !== "pagar") return "Pagamento só para parties a pagar. Usa cobrança para a receber.";
    const due = partyOf(state, party.id);
    if (m.amount > due + 0.001) {
      return `Valor acima do saldo da party (${due.toLocaleString("pt-PT")} Kz).`;
    }
  }

  if (m.kind === "cobranca_party") {
    if (m.from.type !== "party" || m.to.type !== "liquidity") {
      return "Cobrança: party → liquidez.";
    }
    const partyId = m.from.id;
    const party = state.parties.find((p) => p.id === partyId);
    if (!party) return "Party inexistente.";
    if (party.side !== "receber") return "Cobrança só para parties a receber.";
    const due = partyOf(state, party.id);
    if (m.amount > due + 0.001) {
      return `Valor acima do a receber (${due.toLocaleString("pt-PT")} Kz).`;
    }
  }

  // C5: sem overdraft — qualquer saída de liquidez exige saldo.
  if (m.from.type === "liquidity") {
    const cash = liquidityOf(state, m.from.id);
    if (m.amount > cash + 0.001) {
      return `Liquidez insuficiente na conta (${cash.toLocaleString("pt-PT")} Kz).`;
    }
  }

  return null;
}

export function applyAddMovement(
  state: AppState,
  draft: Omit<Movement, "id">,
  id?: string,
): MovementResult {
  const reason = validateMovement(state, draft);
  if (reason) return { ok: false, reason, state };
  const movement: Movement = {
    ...draft,
    id: id ?? `m_${Date.now().toString(36)}`,
    envelopeId:
      draft.kind === "investimento_proprietario"
        ? draft.envelopeId ?? "investimento"
        : draft.envelopeId,
  };
  // Re-validate after defaulting envelope
  const reason2 = validateMovement(state, movement);
  if (reason2) return { ok: false, reason: reason2, state };
  return { ok: true, state: { ...state, movements: [movement, ...state.movements] }, movement };
}

/**
 * Pagamento atómico de dívida: reduz liquidez e reduz obrigação da party.
 * Não depende de IDs hard-coded — usa party.side / ownership do domínio.
 */
export function applyPartyPayment(
  state: AppState,
  opts: {
    partyId: string;
    accountId: string;
    amount: number;
    at?: string;
    note?: string;
    id?: string;
  },
): MovementResult {
  const party = state.parties.find((p) => p.id === opts.partyId);
  if (!party) return { ok: false, reason: "Party inexistente.", state };
  return applyAddMovement(
    state,
    {
      at: opts.at ?? state.asOf,
      kind: "pagamento_party",
      amount: roundKz(opts.amount),
      from: { type: "liquidity", id: opts.accountId },
      to: { type: "party", id: opts.partyId },
      entityId: party.entityId,
      note: opts.note ?? `Pagamento · ${party.name}`,
    },
    opts.id,
  );
}

/** Cobrança atómica: reduz a receber e aumenta liquidez. */
export function applyPartyCollection(
  state: AppState,
  opts: {
    partyId: string;
    accountId: string;
    amount: number;
    at?: string;
    note?: string;
    id?: string;
  },
): MovementResult {
  const party = state.parties.find((p) => p.id === opts.partyId);
  if (!party) return { ok: false, reason: "Party inexistente.", state };
  return applyAddMovement(
    state,
    {
      at: opts.at ?? state.asOf,
      kind: "cobranca_party",
      amount: roundKz(opts.amount),
      from: { type: "party", id: opts.partyId },
      to: { type: "liquidity", id: opts.accountId },
      entityId: party.entityId,
      note: opts.note ?? `Cobrança · ${party.name}`,
    },
    opts.id,
  );
}

export function buildDecisions(state: AppState): Decision[] {
  const m = cfoMetrics(state);
  const fluxo = fluxoMes(state);
  const planned = plannedIncomeTotal(state);
  const basePlaneamento = fluxo.entradas > 0 ? fluxo.entradas : planned;
  const split = splitSalary(basePlaneamento, state.rules);
  const tectoGasto = split.despesas + split.lazer;
  const over = fluxo.despesas > tectoGasto && fluxo.despesas > 0;
  const out: Decision[] = [];

  // 1 — Alocar capital próprio
  if (m.alocavel > 1) {
    out.push({
      id: "alocar",
      question: "O que faço primeiro?",
      answer: `Aloca ${kzAnswer(m.alocavel)} de capital próprio.`,
      detail: `Há dinheiro teu sem função. Liquidez bruta (${m.liquidezBrutaPessoal.toLocaleString("pt-PT")} Kz) e património líquido não são teto de gasto. Custódia (${m.custodia.toLocaleString("pt-PT")} Kz) está excluída. Usa Meter ou «Distribuir esta entrada» no Orçamento.`,
      tone: "bad",
    });
  }

  // 2 — Conta corrente PDS
  if (m.contaCorrenteProprietario > 0) {
    out.push({
      id: "reembolso-pds",
      question: "Devo à PDS?",
      answer: `Sim — ${kzAnswer(m.contaCorrenteProprietario)} na conta corrente.`,
      detail: "Devolver = reembolso, não investimento nem pró-labore. A caixa da empresa não “desapareceu”.",
      tone: "warn",
    });
  }

  // 3 — Dívida própria
  if (m.dividaPropria > 0) {
    const tuni = partyOf(state, "tuni-pag");
    out.push({
      id: "divida-propria",
      question: "Tenho dívida própria prioritária?",
      answer: `Sim — ${kzAnswer(m.dividaPropria)}${tuni > 0 ? ` (ex. Tuni ${tuni.toLocaleString("pt-PT")} Kz)` : ""}.`,
      detail: `Dívida própria: ${m.dividaPropria.toLocaleString("pt-PT")} Kz. Custódia de terceiros (${m.dividaTerceiros.toLocaleString("pt-PT")} Kz) não é tua dívida a juros, mas não é gastável.`,
      tone: "warn",
    });
  }

  // 4 — Custódia
  if (m.custodia > 0) {
    out.push({
      id: "custodia",
      question: "Posso gastar a custódia?",
      answer: "Não.",
      detail: `${m.custodia.toLocaleString("pt-PT")} Kz de terceiros (Lenu, Eduardo, …) estão na liquidez bruta mas fora do teu capital. Não entram no Meter nem no gastável.`,
      tone: "info",
    });
  }

  // 5 — Gastável (só quando já alocou)
  if (m.alocavel <= 1) {
    out.push({
      id: "gastar",
      question: "Quanto posso gastar?",
      answer: kzAnswer(m.gastavel),
      detail: `Gastável = operacional + lazer = ${m.gastavel.toLocaleString("pt-PT")} Kz. Reserva ${m.reservado.toLocaleString("pt-PT")} · investível ${m.investivel.toLocaleString("pt-PT")} — não gastáveis.`,
      tone: m.gastavel > 0 ? "ok" : "warn",
    });
  }

  // 6 — Investir (só com bolso)
  if (m.investivel > 0) {
    out.push({
      id: "investir",
      question: "Posso meter dinheiro nas empresas?",
      answer: `Sim — até ${kzAnswer(m.investivel)} do bolso investimento.`,
      detail: "PDS ou Plural: investimento do proprietário. Nunca da caixa delas nem do operacional/lazer.",
      tone: "info",
    });
  }

  // 7 — Acima do planeado
  if (fluxo.despesas > 0) {
    out.push({
      id: "acima",
      question: "Estou a gastar acima do planeado?",
      answer: over ? "Sim." : "Não, dentro do tecto.",
      detail: `Despesas reais: ${fluxo.despesas.toLocaleString("pt-PT")} Kz. Tecto (regras × ${fluxo.entradas > 0 ? "entradas reais" : "renda planeada"} ${basePlaneamento.toLocaleString("pt-PT")} Kz): ${tectoGasto.toLocaleString("pt-PT")} Kz. Entradas reais do mês: ${fluxo.entradas.toLocaleString("pt-PT")} Kz.`,
      tone: over ? "bad" : "ok",
    });
  }

  // 8 — Planeado ≠ recebido
  if (planned > 0 && Math.abs(fluxo.entradas - planned) > 1_000) {
    out.push({
      id: "renda-gap",
      question: "A renda do mês bate com o plano?",
      answer:
        fluxo.entradas === 0
          ? `Ainda sem entradas reais — plano ${kzAnswer(planned)}.`
          : `Não — recebido ${kzAnswer(fluxo.entradas)} vs plano ${kzAnswer(planned)}.`,
      detail: "Fontes de renda no Orçamento são planeamento. Entradas reais = movimentos de receita pessoal deste mês.",
      tone: fluxo.entradas === 0 ? "info" : "warn",
    });
  }

  // 9 — Inventário das % (linhas concretas)
  if (planned > 0) {
    const ob = budgetBucketGap(state, "obrigacoes");
    if (!ob.hasLines) {
      out.push({
        id: "linhas-obrigacoes",
        question: "O que entra nos 30% de obrigações?",
        answer: "Ainda não listaste.",
        detail: `Tecto ${kzAnswer(ob.ceiling)}. No Orçamento, em «O que entra em cada %», adiciona renda, luz, internet, dívidas fixas, etc.`,
        tone: "info",
      });
    }
    const overBuckets = (["obrigacoes", "despesas", "lazer", "reserva", "investimento"] as const)
      .map((b) => ({ b, g: budgetBucketGap(state, b) }))
      .filter(({ g }) => g.hasLines && g.gap > 1);
    for (const { b, g } of overBuckets) {
      out.push({
        id: `tecto-${b}`,
        question: `Linhas de ${b} cabem no tecto?`,
        answer: `Não — ${kzAnswer(g.planned)} vs tecto ${kzAnswer(g.ceiling)}.`,
        detail: `Excesso ${kzAnswer(g.gap)}. Reduz linhas, sobe a % nesta categoria, ou sobe a renda planeada.`,
        tone: "warn",
      });
    }
  }

  // 10 — Fallback
  if (out.length === 0) {
    out.push({
      id: "ok",
      question: "O que faço agora?",
      answer: "Nada urgente.",
      detail: `Gastável ${m.gastavel.toLocaleString("pt-PT")} Kz · alocável ${m.alocavel.toLocaleString("pt-PT")} · renda planeada ${planned.toLocaleString("pt-PT")} · entradas reais ${fluxo.entradas.toLocaleString("pt-PT")}.`,
      tone: "ok",
    });
  }

  return out;
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

// —— Openings: não reescrever silenciosamente após movimentos ——

function movementTouchesLiquidity(m: Movement, accountId: string) {
  if (m.kind === "alocacao") return false;
  if (m.from.type === "world" && m.to.type === "world") return false;
  return hit(m.to, "liquidity", accountId) || hit(m.from, "liquidity", accountId);
}

function movementTouchesParty(m: Movement, partyId: string) {
  return hit(m.to, "party", partyId) || hit(m.from, "party", partyId);
}

/** Há movimentos (exceto alocação / stub world→world) que afectam esta conta. */
export function accountHasLedgerMovements(state: AppState, accountId: string) {
  return state.movements.some((m) => movementTouchesLiquidity(m, accountId));
}

export function partyHasLedgerMovements(state: AppState, partyId: string) {
  return state.movements.some((m) => movementTouchesParty(m, partyId));
}

export function canEditAccountOpening(state: AppState, accountId: string) {
  return !accountHasLedgerMovements(state, accountId);
}

export function canEditPartyOpening(state: AppState, partyId: string) {
  return !partyHasLedgerMovements(state, partyId);
}

export type OpeningEditResult =
  | { ok: true; state: AppState }
  | { ok: false; reason: string; state: AppState };

/** Define opening só se ainda não houver movimentos no ledger dessa conta. */
export function applyAccountOpening(state: AppState, accountId: string, opening: number): OpeningEditResult {
  if (!state.accounts.some((a) => a.id === accountId)) {
    return { ok: false, reason: "Conta inexistente.", state };
  }
  if (!canEditAccountOpening(state, accountId)) {
    return {
      ok: false,
      reason: "Opening bloqueado: já existem movimentos. Usa um ajuste auditado.",
      state,
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, opening } : a)),
    },
  };
}

export function applyPartyOpening(state: AppState, partyId: string, opening: number): OpeningEditResult {
  if (!state.parties.some((p) => p.id === partyId)) {
    return { ok: false, reason: "Party inexistente.", state };
  }
  if (!canEditPartyOpening(state, partyId)) {
    return {
      ok: false,
      reason: "Opening da party bloqueado: já existem movimentos. Usa um ajuste auditado.",
      state,
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      parties: state.parties.map((p) => (p.id === partyId ? { ...p, opening } : p)),
    },
  };
}

/**
 * Corrige o saldo vivo sem alterar o opening: cria movimento `ajuste`.
 * target = saldo desejado em liquidityOf.
 */
export function postLiquidityAdjustment(
  state: AppState,
  accountId: string,
  targetBalance: number,
  opts?: { at?: string; note?: string; id?: string },
): OpeningEditResult {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return { ok: false, reason: "Conta inexistente.", state };
  const current = liquidityOf(state, accountId);
  const diff = roundKz(targetBalance - current);
  if (diff === 0) return { ok: true, state };

  const amount = Math.abs(diff);
  const m: Movement = {
    id: opts?.id ?? `ajuste-${accountId}-${Date.now()}`,
    at: opts?.at ?? state.asOf,
    kind: "ajuste",
    amount,
    from: diff > 0 ? { type: "world" } : { type: "liquidity", id: accountId },
    to: diff > 0 ? { type: "liquidity", id: accountId } : { type: "world" },
    entityId: acc.entityId,
    note: opts?.note ?? `Ajuste auditado de saldo (${current} → ${targetBalance})`,
  };
  return { ok: true, state: { ...state, movements: [m, ...state.movements] } };
}
