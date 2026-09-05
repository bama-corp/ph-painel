import type { EntityId } from "./types";

/** Nomes de ecrã. IDs internos (`cw`, `rove`) mantêm-se estáveis no ledger. */
export const ENTITY = {
  pessoal: { id: "pessoal" as const, short: "Pessoal", full: "Pessoal" },
  cw: { id: "cw" as const, short: "PDS", full: "PADStation" },
  rove: { id: "rove" as const, short: "Plural", full: "Plural" },
  picasso: { id: "picasso" as const, short: "Picasso's", full: "Picasso's" },
  ph: { id: "ph" as const, short: "PH", full: "PH" },
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
