export type EntityId = "pessoal" | "cw" | "rove" | "picasso" | "ph";

export const COMPANIES: Exclude<EntityId, "pessoal">[] = ["cw", "rove", "picasso", "ph"];

/** Classificação de ownership — nunca inferida só pelo entityId da conta. */
export type OwnershipClass = "own" | "custody" | "company";

/** Versão actual do schema persistido. */
export const SCHEMA_VERSION = 6;

export type MovementKind =
  | "receita"
  | "despesa"
  | "transferencia"
  | "interempresa"
  | "investimento_proprietario"
  | "emprestimo_proprietario"
  | "prolabore"
  | "distribuicao"
  | "reembolso"
  | "despesa_pessoal_pela_empresa"
  | "alocacao"
  | "ajuste"
  | "pagamento_party"
  | "cobranca_party";

export type AccountKind = "banco" | "caixa" | "cofre" | "stand";

export type LiquidityAccount = {
  id: string;
  entityId: EntityId;
  name: string;
  kind: AccountKind;
  opening: number;
};

export type Envelope = {
  id: string;
  name: string;
  purpose: string;
};

export type Party = {
  id: string;
  entityId: EntityId;
  name: string;
  side: "receber" | "pagar";
  opening: number;
  /** own = pessoal; custody = terceiros; company = relação empresa/proprietário */
  ownership: OwnershipClass;
  unknown?: boolean;
  linkedEntityId?: EntityId;
  /** Conta corrente do proprietário na empresa */
  role?: "owner_current";
};

export type Asset = {
  id: string;
  entityId: EntityId;
  name: string;
  value: number;
};

export type Endpoint =
  | { type: "liquidity"; id: string }
  | { type: "envelope"; id: string }
  | { type: "party"; id: string }
  | { type: "world" }
  | { type: "unallocated" };

export type CwCategory =
  | "jogos"
  | "impressoes"
  | "copias"
  | "trabalhos"
  | "manutencao"
  | "outros"
  | "por_classificar";

export type CostNature = "fixo" | "variavel" | "investimento" | "retirada";

export type Movement = {
  id: string;
  at: string;
  kind: MovementKind;
  amount: number;
  from: Endpoint;
  to: Endpoint;
  entityId: EntityId;
  otherEntityId?: EntityId;
  category?: CwCategory;
  costNature?: CostNature;
  method?: string;
  responsible?: string;
  note?: string;
  clientId?: string;
  envelopeId?: string;
};

export type BudgetRules = {
  obrigacoes: number;
  reserva: number;
  investimento: number;
  despesas: number;
  lazer: number;
};

export type RoveProduct = "netflix" | "iptv";

export type RoveStatus =
  | "ativo"
  | "vence_em_breve"
  | "em_atraso"
  | "suspenso"
  | "cancelado"
  | "potencial";

export type RoveClient = {
  id: string;
  name: string;
  product: RoveProduct;
  price: number;
  dueDay: number;
  status: RoveStatus;
  lastPayment: string | null;
  nextPayment: string | null;
};

export type RecurringCost = {
  id: string;
  entityId: EntityId;
  name: string;
  amount: number;
  nature: CostNature;
  product?: RoveProduct | "geral";
};

export type Declared = {
  cwRevenueJuly: number;
  roveRevenue: number;
  roveProfit: number;
  /** Compat: espelho de plannedIncomeTotal (soma das fontes activas). */
  salary: number;
};

/** Fonte de renda pessoal planeada (mensal). Não é movimento — é planeamento. */
export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  active: boolean;
};

export type NotebookEntry = {
  id: string;
  at: string;
  title: string;
  body: string;
};

export type AppState = {
  schemaVersion: number;
  asOf: string;
  month: string;
  rules: BudgetRules;
  /** Método de divisão activo (`50-30-20`, `ph-bolsos`, `custom`, …). */
  budgetMethodId: string;
  accounts: LiquidityAccount[];
  envelopes: Envelope[];
  parties: Party[];
  assets: Asset[];
  movements: Movement[];
  roveClients: RoveClient[];
  recurring: RecurringCost[];
  /** Fontes de renda planeadas (GSA, freelance, …). Fonte de verdade do planeamento. */
  incomeSources: IncomeSource[];
  declared: Declared;
  notes: NotebookEntry[];
};

export type AlertTone = "warn" | "bad" | "info";

export type Alert = {
  id: string;
  tone: AlertTone;
  text: string;
  href?: string;
};

export type Decision = {
  id: string;
  question: string;
  answer: string;
  detail: string;
  tone: AlertTone | "ok";
};
