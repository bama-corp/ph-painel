/**
 * Regras de funcionamento do painel — referência operacional.
 * Métodos de divisão alteram BudgetRules (Orçamento / Distribuir entrada).
 */
import type { BudgetRules } from "./types";

export type RuleItem = {
  id: string;
  title: string;
  body: string;
};

export type RuleSection = {
  id: string;
  title: string;
  lede: string;
  rules: RuleItem[];
};

export type SplitMethod = {
  id: string;
  name: string;
  needs: string;
  wants: string;
  future: string;
  /** Percentagens PH — obrigações+despesas=necessidades; lazer=estilo; reserva+investimento=futuro. */
  rules: BudgetRules;
};

export type ChecklistItem = {
  id: string;
  label: string;
};

export const DEFINICAO_SECTIONS: RuleSection[] = [
  {
    id: "entrada",
    title: "Entrada",
    lede: "Receitas próprias — o que realmente entra na caixa pessoal.",
    rules: [
      {
        id: "registo-imediato",
        title: "Registo imediato",
        body: "Anota toda receita no momento em que receber (salário, freelance, rendimentos, presentes em dinheiro) no Registo.",
      },
      {
        id: "renda-liquida",
        title: "Renda líquida",
        body: "Trabalha sempre com o valor que realmente cai na conta (após impostos e deduções), não com o bruto.",
      },
      {
        id: "diversificacao-renda",
        title: "Diversificação",
        body: "Procura ter pelo menos 2 fontes de renda activas no Orçamento (principal + secundária) para reduzir risco.",
      },
      {
        id: "aumento-proporcional",
        title: "Aumento proporcional",
        body: "Quando a renda sobe, aumenta primeiro o percentual de investimento / reserva antes de elevar o padrão de vida.",
      },
    ],
  },
  {
    id: "obrigacoes",
    title: "Obrigações",
    lede: "Despesas fixas e essenciais — o que não podes falhar.",
    rules: [
      {
        id: "regra-50",
        title: "Regra dos 50%",
        body: "Destina no máximo 50% da renda líquida a necessidades básicas (moradia, alimentação, transporte, saúde, educação).",
      },
      {
        id: "teto-moradia",
        title: "Tecto de moradia",
        body: "Renda / financiamento + condomínio não devem ultrapassar 30% da renda líquida.",
      },
      {
        id: "quitacao",
        title: "Quitação prioritária",
        body: "Dívidas com juros altos devem ser quitadas antes de qualquer investimento novo (usa Decisão + pagamento de parties).",
      },
      {
        id: "revisao-trimestral",
        title: "Revisão trimestral",
        body: "A cada 3 meses, renegocia ou pesquisa preços melhores para contas fixas (internet, saúde, seguros).",
      },
    ],
  },
  {
    id: "reserva",
    title: "Reserva",
    lede: "Segurança — dinheiro que não é para o dia a dia.",
    rules: [
      {
        id: "3-6-meses",
        title: "3–6 meses",
        body: "Mantém uma reserva de emergência equivalente a 3 a 6 meses das despesas essenciais (bolso reserva).",
      },
      {
        id: "intocabilidade",
        title: "Intocabilidade",
        body: "A reserva só se usa em emergências reais (perda de renda, saúde) — não para desejos nem imprevistos planeáveis.",
      },
      {
        id: "liquidez-reserva",
        title: "Liquidez",
        body: "Mantém a reserva em instrumentos de alta liquidez e baixo risco (conta/depósito acessível), não em activos difíceis de vender.",
      },
      {
        id: "reposicao",
        title: "Reposição imediata",
        body: "Se usares parte da reserva, prioriza a recomposição no mês seguinte via Meter / distribuir entrada.",
      },
    ],
  },
  {
    id: "investimento",
    title: "Investimento",
    lede: "Construção de património — bolso investimento e capital para empresas.",
    rules: [
      {
        id: "regra-20",
        title: "Regra dos 20%",
        body: "Destina pelo menos 20% da renda líquida a prioridades financeiras (investimentos + quitação de dívidas + reserva).",
      },
      {
        id: "automatico",
        title: "Investimento automático",
        body: "Assim que a renda cair, paga-te primeiro: Meter para o bolso investimento antes de gastar em lazer.",
      },
      {
        id: "consistencia",
        title: "Consistência",
        body: "Investe todo o mês, mesmo valores pequenos — a regularidade importa mais que o valor inicial.",
      },
      {
        id: "alinhamento",
        title: "Alinhamento",
        body: "Escolhe destinos compatíveis com o teu horizonte (curto, médio, longo) e com o risco que aceitas.",
      },
      {
        id: "diversificacao-ativos",
        title: "Diversificação",
        body: "Não concentrates todo o capital num único activo, empresa ou tipo de movimento.",
      },
    ],
  },
  {
    id: "despesas",
    title: "Despesas",
    lede: "Gastos variáveis — controlo sem inventar dinheiro.",
    rules: [
      {
        id: "registo-diario",
        title: "Registo diário",
        body: "Anota os gastos do dia no Registo (5–10 min) — no máximo até ao fim do dia. Não confies na memória.",
      },
      {
        id: "categorizacao",
        title: "Categorização",
        body: "Toda despesa pessoal exige bolso (operacional, lazer, …). Sem bolso o sistema rejeita.",
      },
      {
        id: "24-horas",
        title: "Regra das 24 horas",
        body: "Para compras não essenciais acima de um valor que defines (ex. 50 000 Kz), espera 24 horas antes de decidir.",
      },
      {
        id: "limite-semanal",
        title: "Limite semanal",
        body: "Define um tecto semanal para gastos variáveis (mercado, transporte, pequenos gastos) e respeita-o.",
      },
      {
        id: "revisao-semanal",
        title: "Revisão semanal",
        body: "15 minutos por semana: Eu + Contas + bolsos — estás dentro do planeado?",
      },
    ],
  },
  {
    id: "lazer",
    title: "Lazer",
    lede: "Qualidade de vida — gastável com culpa zero até ao saldo do bolso.",
    rules: [
      {
        id: "regra-30",
        title: "Regra dos 30%",
        body: "Destina até 30% da renda a estilo de vida e lazer (quando usas metodologias 50/30/20). No PH o bolso lazer é o tecto real.",
      },
      {
        id: "orcamento-diversao",
        title: "Orçamento de diversão",
        body: "Tem um valor mensal no bolso lazer — evita sensação de sacrifício e ajuda a cumprir o plano.",
      },
      {
        id: "lazer-planejado",
        title: "Lazer planeado",
        body: "Planeia com antecedência viagens e passeios maiores para evitar gasto por impulso.",
      },
      {
        id: "equilibrio",
        title: "Equilíbrio",
        body: "Não elimines o lazer. Orçamentos demasiado restritivos tendem a falhar.",
      },
    ],
  },
  {
    id: "complementares",
    title: "Complementares",
    lede: "Hábitos que sustentam o sistema no tempo.",
    rules: [
      {
        id: "diagnostico",
        title: "Diagnóstico inicial",
        body: "Antes de planear, faz o raio-X: Eu, Contas, Decisão — receitas, despesas, dívidas, património.",
      },
      {
        id: "metas-smart",
        title: "Metas SMART",
        body: "Define metas Específicas, Mensuráveis, Atingíveis, Relevantes e com Tempo — regista-as no Caderno.",
      },
      {
        id: "reuniao",
        title: "Reunião de orçamento",
        body: "Uma revisão mensal (ou quinzenal) do mês passado e do próximo.",
      },
      {
        id: "longo-prazo",
        title: "Fundo de longo prazo",
        body: "Separar ~10% da renda para despesas grandes futuras (trocas, obras, emergências maiores) via reserva/investimento.",
      },
      {
        id: "educacao",
        title: "Educação financeira",
        body: "Destina tempo (e, se fizer sentido, orçamento) a aprender — conhecimento reduz erros caros.",
      },
      {
        id: "progresso",
        title: "Progresso visível",
        body: "Acompanha Eu e Decisão: números claros mantêm motivação.",
      },
      {
        id: "ajuste",
        title: "Ajuste contínuo",
        body: "Revê percentagens e fontes no Orçamento todos os meses com base no que funcionou.",
      },
    ],
  },
];

/** Métodos que reescrevem as % dos bolsos (soma = 100). */
export const SPLIT_METHODS: SplitMethod[] = [
  {
    id: "50-30-20",
    name: "50 / 30 / 20",
    needs: "50% → operacional (obrigações + despesas)",
    wants: "30% → lazer",
    future: "20% → reserva + investimento",
    rules: { obrigacoes: 30, despesas: 20, lazer: 30, reserva: 10, investimento: 10 },
  },
  {
    id: "60-20-20",
    name: "60 / 20 / 20",
    needs: "60% → operacional",
    wants: "20% → lazer",
    future: "20% → reserva + investimento",
    rules: { obrigacoes: 35, despesas: 25, lazer: 20, reserva: 10, investimento: 10 },
  },
  {
    id: "50-15-35",
    name: "50 / 15 / 35",
    needs: "50% → operacional",
    wants: "35% → lazer",
    future: "15% → reserva + investimento",
    rules: { obrigacoes: 30, despesas: 20, lazer: 35, reserva: 8, investimento: 7 },
  },
  {
    id: "ph-bolsos",
    name: "Bolsos PH",
    needs: "Obrigações 30% + despesas 20% → operacional",
    wants: "Lazer 10%",
    future: "Reserva 20% + investimento 20%",
    rules: { obrigacoes: 30, despesas: 20, lazer: 10, reserva: 20, investimento: 20 },
  },
];

export const ACCUMULATION_METHODS: RuleItem[] = [
  {
    id: "progressivo",
    title: "Progressivo",
    body: "Começa com um valor pequeno e aumenta de forma regular para criar disciplina.",
  },
  {
    id: "fixo",
    title: "Fixo",
    body: "Valor fixo mensal para guardar/investir, independente de pequenas variações de renda.",
  },
  {
    id: "arredondamento",
    title: "Arredondamento",
    body: "Arredonda gastos para cima e guarda a diferença no bolso reserva ou investimento.",
  },
];

export const DEFINICAO_CHECKLIST: ChecklistItem[] = [
  { id: "renda-liquida", label: "Definir renda líquida mensal (fontes no Orçamento)" },
  { id: "calc-50", label: "Calcular tecto ~50% para necessidades" },
  { id: "calc-30", label: "Calcular espaço ~30% para lazer / estilo" },
  { id: "calc-20", label: "Calcular ~20% para investimento / reserva / dívidas" },
  { id: "reserva-conta", label: "Ter sítio claro para a reserva de emergência" },
  { id: "pagar-primeiro", label: "Hábito: Meter / distribuir logo após a entrada" },
  { id: "registo", label: "Usar o Registo no dia (não no fim do mês)" },
  { id: "rev-semanal", label: "Agendar revisão semanal (15 min)" },
  { id: "rev-mensal", label: "Agendar revisão mensal" },
  { id: "metas", label: "Definir metas SMART no Caderno" },
];

export const CHECKLIST_STORAGE_KEY = "ph-definicao-checklist-v1";
export const CUSTOM_BUDGET_METHOD_ID = "custom";

export function splitMethodById(id: string): SplitMethod | undefined {
  return SPLIT_METHODS.find((m) => m.id === id);
}

export function rulesEqual(a: BudgetRules, b: BudgetRules) {
  return (
    a.obrigacoes === b.obrigacoes &&
    a.reserva === b.reserva &&
    a.investimento === b.investimento &&
    a.despesas === b.despesas &&
    a.lazer === b.lazer
  );
}

/** Detecta método a partir das % (ou custom). */
export function detectBudgetMethodId(rules: BudgetRules): string {
  const hit = SPLIT_METHODS.find((m) => rulesEqual(m.rules, rules));
  return hit?.id ?? CUSTOM_BUDGET_METHOD_ID;
}

export function applySplitMethodRules(methodId: string): { ok: true; rules: BudgetRules; methodId: string } | { ok: false; reason: string } {
  const method = splitMethodById(methodId);
  if (!method) return { ok: false, reason: "Método desconhecido." };
  const r = method.rules;
  const sum = r.obrigacoes + r.reserva + r.investimento + r.despesas + r.lazer;
  if (sum !== 100) return { ok: false, reason: "Método com percentagens inválidas." };
  return { ok: true, rules: { ...r }, methodId: method.id };
}
