import type { EntityId } from "./types";
import { COMPANIES } from "./types";

/** Tom visual partilhado por Mark, rails e headers. */
export type EntityTone = "ink" | "pine" | "copper" | "moss" | "clay";

export type EntityMeta = {
  id: EntityId;
  short: string;
  full: string;
  path: string;
  tone: EntityTone;
  rail: string;
  /** Lede curto nas páginas de entidade (empresas). */
  lede?: string;
};

/** Nomes de ecrã. IDs internos (`cw`, `rove`) mantêm-se estáveis no ledger. */
export const ENTITY: Record<EntityId, EntityMeta> = {
  pessoal: {
    id: "pessoal",
    short: "Pessoal",
    full: "Pessoal",
    path: "/contas",
    tone: "pine",
    rail: "rgb(var(--pine))",
  },
  cw: {
    id: "cw",
    short: "PDS",
    full: "PADStation",
    path: "/pds",
    tone: "copper",
    rail: "rgb(var(--copper))",
    lede: "PADStation — empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema pergunta o tipo.",
  },
  rove: {
    id: "rove",
    short: "Plural",
    full: "Plural",
    path: "/plural",
    tone: "moss",
    rail: "rgb(var(--moss))",
    lede: "Recorrência. Cliente não é pagamento. A faturação declarada só conta quando o cliente paga.",
  },
  picasso: {
    id: "picasso",
    short: "Picasso's",
    full: "Picasso's",
    path: "/picasso",
    tone: "ink",
    rail: "rgb(var(--ink))",
    lede: "Picasso's — empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema pergunta o tipo.",
  },
  ph: {
    id: "ph",
    short: "PH",
    full: "PH",
    path: "/ph",
    tone: "clay",
    rail: "rgb(var(--clay))",
    lede: "PH — empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema pergunta o tipo.",
  },
};

export function entityShort(id: EntityId) {
  return ENTITY[id].short;
}

export function entityFull(id: EntityId) {
  return ENTITY[id].full;
}

export function entityLabel(id: EntityId) {
  const e = ENTITY[id];
  return e.short === e.full ? e.short : `${e.short} (${e.full})`;
}

export function entityTone(id: EntityId): EntityTone {
  return ENTITY[id].tone;
}

/** Opções de select: short (nav/filtro) ou full (formulários). */
export function entitySelectOptions(mode: "short" | "full" = "short") {
  return (Object.keys(ENTITY) as EntityId[]).map((id) => ({
    value: id,
    label: mode === "full" ? entityLabel(id) : entityShort(id),
  }));
}

export const ENTITY_FILTER_OPTIONS = [
  { value: "todas" as const, label: "Todas" },
  ...entitySelectOptions("short"),
];

/** Nav: Eu → pessoal/empresas → registo/decisão. */
export const NAV_LINKS = [
  { to: "/", label: "Eu" },
  { to: "/definicao", label: "Definição" },
  { to: "/orcamento", label: "Orçamento" },
  { to: "/contas", label: "Contas" },
  ...COMPANIES.map((id) => ({ to: ENTITY[id].path, label: ENTITY[id].short })),
  { to: "/movimentos", label: "Registo" },
  { to: "/decisao", label: "Decisão" },
  { to: "/caderno", label: "Caderno" },
];
