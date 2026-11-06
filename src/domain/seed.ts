import type { AppState } from "./types";
import { SCHEMA_VERSION } from "./types";
import { currentMonthIso, todayIso } from "./money";

/** Extracto 2 nov 2026 — saldo vivo de cada conta (não só o opening). */
export const ACCOUNT_SNAPSHOT: Record<string, number> = {
  bai: 880000,
  bfa: 1441.2,
  atlantico: 43416.03,
  stand: 1775.25,
  "caixa-p": 82600,
  cofre: 0,
  "cw-caixa": 46210,
  "cw-bai2": 29772.33,
  "rove-caixa": 79101.94,
  "picasso-caixa": 26500,
  "ph-caixa": 63500,
};

/** Só contas pessoais — o Total (saldo vivo), sem mexer na custódia. */
export const PERSONAL_LIVE_SNAPSHOT: Record<string, number> = {
  bai: ACCOUNT_SNAPSHOT.bai,
  bfa: ACCOUNT_SNAPSHOT.bfa,
  stand: ACCOUNT_SNAPSHOT.stand,
  cofre: ACCOUNT_SNAPSHOT.cofre,
  "caixa-p": ACCOUNT_SNAPSHOT["caixa-p"],
  atlantico: ACCOUNT_SNAPSHOT.atlantico,
};

/** PDS — só o Total (saldo vivo). */
export const PDS_LIVE_SNAPSHOT: Record<string, number> = {
  "cw-caixa": ACCOUNT_SNAPSHOT["cw-caixa"],
  "cw-bai2": ACCOUNT_SNAPSHOT["cw-bai2"],
};

/** Plural, Picasso's e PH — só o Total (saldo vivo). */
export const OTHER_COMPANY_LIVE_SNAPSHOT: Record<string, number> = {
  "rove-caixa": ACCOUNT_SNAPSHOT["rove-caixa"],
  "picasso-caixa": ACCOUNT_SNAPSHOT["picasso-caixa"],
  "ph-caixa": ACCOUNT_SNAPSHOT["ph-caixa"],
};

/**
 * Snapshot actualizado 2 nov 2026.
 * Conta BAI é só PDS. Não há fatia pessoal nessa conta.
 * Lenu e Eduardo (GTA) são custody (terceiros) dentro da liquidez pessoal bruta.
 */
export function seedState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    asOf: todayIso(),
    month: currentMonthIso(),
    rules: {
      obrigacoes: 30,
      reserva: 20,
      investimento: 20,
      despesas: 20,
      lazer: 10,
    },
    budgetMethodId: "ph-bolsos",
    accounts: [
      { id: "bai", entityId: "pessoal", name: "BAI 1", kind: "banco", opening: ACCOUNT_SNAPSHOT.bai },
      { id: "bfa", entityId: "pessoal", name: "BFA", kind: "banco", opening: ACCOUNT_SNAPSHOT.bfa },
      { id: "atlantico", entityId: "pessoal", name: "ATLANTICO", kind: "banco", opening: ACCOUNT_SNAPSHOT.atlantico },
      { id: "stand", entityId: "pessoal", name: "STANDARD", kind: "stand", opening: ACCOUNT_SNAPSHOT.stand },
      { id: "caixa-p", entityId: "pessoal", name: "Caixa", kind: "caixa", opening: ACCOUNT_SNAPSHOT["caixa-p"] },
      { id: "cofre", entityId: "pessoal", name: "Carteira", kind: "cofre", opening: ACCOUNT_SNAPSHOT.cofre },
      { id: "cw-caixa", entityId: "cw", name: "Caixa PDS", kind: "caixa", opening: ACCOUNT_SNAPSHOT["cw-caixa"] },
      { id: "cw-bai2", entityId: "cw", name: "Conta BAI", kind: "banco", opening: ACCOUNT_SNAPSHOT["cw-bai2"] },
      { id: "rove-caixa", entityId: "rove", name: "Caixa Plural", kind: "caixa", opening: ACCOUNT_SNAPSHOT["rove-caixa"] },
      { id: "picasso-caixa", entityId: "picasso", name: "Caixa Picasso's", kind: "caixa", opening: ACCOUNT_SNAPSHOT["picasso-caixa"] },
      { id: "ph-caixa", entityId: "ph", name: "Caixa PH", kind: "caixa", opening: ACCOUNT_SNAPSHOT["ph-caixa"] },
    ],
    envelopes: [
      { id: "operacional", name: "Operacional", purpose: "Despesas do dia a dia. Não é o total que vês no banco." },
      { id: "reserva", name: "Reserva", purpose: "Não se usa no quotidiano." },
      { id: "investimento", name: "Investimento", purpose: "Construção de património." },
      { id: "lazer", name: "Lazer", purpose: "Podes gastar sem culpa, até ao saldo deste bolso." },
      { id: "projectos", name: "Projectos", purpose: "Dinheiro pessoal que decidiste meter num projecto." },
    ],
    parties: [
      { id: "gsa", entityId: "pessoal", name: "GSA — jun/jul (pago)", side: "receber", opening: 0, ownership: "own" },
      { id: "ferraz", entityId: "pessoal", name: "Chefe Ferraz", side: "receber", opening: 55000, ownership: "own" },
      { id: "bt", entityId: "pessoal", name: "BT", side: "receber", opening: 34000, ownership: "own" },
      { id: "tuni-pag", entityId: "pessoal", name: "Tuni", side: "pagar", opening: 60000, ownership: "own" },
      {
        id: "lenu",
        entityId: "pessoal",
        name: "Lenu (terceiros)",
        side: "pagar",
        opening: 437600,
        ownership: "custody",
        heldInAccountId: "atlantico",
      },
      {
        id: "eduardo-gta",
        entityId: "pessoal",
        name: "Eduardo — GTA 6 (terceiros)",
        side: "pagar",
        opening: 43316,
        ownership: "custody",
        heldInAccountId: "atlantico",
      },
      {
        id: "emanuel-cw",
        entityId: "cw",
        name: "Emanuel — conta corrente",
        side: "receber",
        opening: 0,
        ownership: "company",
        linkedEntityId: "pessoal",
        role: "owner_current",
      },
    ],
    assets: [
      { id: "ps5", entityId: "pessoal", name: "PS5 + 2 comandos", value: 0 },
      { id: "tv-p", entityId: "pessoal", name: "TV", value: 0 },
      { id: "pcs-p", entityId: "pessoal", name: "Computadores pessoais", value: 0 },
      { id: "eq-cw", entityId: "cw", name: "Equipamentos PDS (PS, PCs, impressoras)", value: 0 },
    ],
    movements: [
      {
        id: "m-jul-cw",
        at: "2026-07-31",
        kind: "receita",
        amount: 86460,
        from: { type: "world" },
        to: { type: "world" },
        entityId: "cw",
        category: "por_classificar",
        note: "Faturação de julho — ainda não desdobrada por serviço. Não entra na caixa actual.",
      },
    ],
    roveClients: [
      { id: "rn1", name: "Netflix 1", product: "netflix", price: 4500, dueDay: 5, status: "ativo", lastPayment: null, nextPayment: "2026-09-05" },
      { id: "rn2", name: "Netflix 2", product: "netflix", price: 4500, dueDay: 8, status: "ativo", lastPayment: null, nextPayment: "2026-09-08" },
      { id: "rn3", name: "Netflix 3", product: "netflix", price: 4500, dueDay: 12, status: "vence_em_breve", lastPayment: null, nextPayment: "2026-09-01" },
      { id: "rn4", name: "Netflix 4", product: "netflix", price: 4500, dueDay: 20, status: "em_atraso", lastPayment: null, nextPayment: "2026-08-20" },
      { id: "ri1", name: "IPTV 1", product: "iptv", price: 9500, dueDay: 3, status: "ativo", lastPayment: null, nextPayment: "2026-09-03" },
      { id: "ri2", name: "IPTV 2", product: "iptv", price: 9500, dueDay: 15, status: "em_atraso", lastPayment: null, nextPayment: "2026-08-15" },
      { id: "rp1", name: "Potencial IPTV 1", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp2", name: "Potencial IPTV 2", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp3", name: "Potencial IPTV 3", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp4", name: "Potencial IPTV 4", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp5", name: "Potencial IPTV 5", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp6", name: "Potencial IPTV 6", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
      { id: "rp7", name: "Potencial IPTV 7", product: "iptv", price: 9500, dueDay: 1, status: "potencial", lastPayment: null, nextPayment: null },
    ],
    recurring: [
      { id: "func-cw", entityId: "cw", name: "Funcionário", amount: 35000, nature: "fixo", active: true },
      {
        id: "rove-netflix",
        entityId: "rove",
        name: "Contas Netflix (lotes)",
        amount: 12000,
        nature: "variavel",
        product: "netflix",
        active: true,
      },
      {
        id: "rove-iptv",
        entityId: "rove",
        name: "Plataforma IPTV",
        amount: 25000,
        nature: "fixo",
        product: "iptv",
        active: true,
      },
    ],
    incomeSources: [
      { id: "gsa", name: "Salário GSA", amount: 220000, active: true },
    ],
    budgetLines: [],
    declared: {
      cwRevenueJuly: 86460,
      roveRevenue: 83500,
      roveProfit: 29000,
      salary: 220000,
    },
    notes: [],
    removedPartyIds: [],
  };
}
