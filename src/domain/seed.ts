import type { AppState } from "./types";
import { SCHEMA_VERSION } from "./types";
import { todayIso } from "./money";

/**
 * Snapshot actualizado 19 set 2026.
 * BAI 2 é só PDS (10.711,38 na conta + 89.200 conta corrente do dono).
 * Não há fatia pessoal no BAI 2.
 * Lenu e Eduardo (GTA) são custody (terceiros) dentro da liquidez pessoal bruta.
 */
export function seedState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    asOf: todayIso(),
    month: "2026-08",
    rules: {
      obrigacoes: 30,
      reserva: 20,
      investimento: 20,
      despesas: 20,
      lazer: 10,
    },
    budgetMethodId: "ph-bolsos",
    accounts: [
      { id: "bai", entityId: "pessoal", name: "BAI", kind: "banco", opening: 111303.02 },
      { id: "bfa", entityId: "pessoal", name: "BFA", kind: "banco", opening: 10107.06 },
      { id: "atlantico", entityId: "pessoal", name: "ATLANTICO", kind: "banco", opening: 59500 },
      { id: "stand", entityId: "pessoal", name: "STAND", kind: "stand", opening: 1000000 },
      { id: "caixa-p", entityId: "pessoal", name: "Caixa", kind: "caixa", opening: 1800 },
      { id: "cofre", entityId: "pessoal", name: "Cofre", kind: "cofre", opening: 0 },
      { id: "cw-caixa", entityId: "cw", name: "Caixa PDS", kind: "caixa", opening: 29060 },
      { id: "cw-bai2", entityId: "cw", name: "BAI 2", kind: "banco", opening: 10711.38 },
      { id: "rove-caixa", entityId: "rove", name: "Caixa Plural", kind: "caixa", opening: 72508.78 },
      { id: "picasso-caixa", entityId: "picasso", name: "Caixa Picasso's", kind: "caixa", opening: 21500 },
      { id: "ph-caixa", entityId: "ph", name: "Caixa PH", kind: "caixa", opening: 36500 },
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
      { id: "nuno", entityId: "pessoal", name: "Nuno", side: "receber", opening: 8000, ownership: "own" },
      { id: "daniela", entityId: "pessoal", name: "Daniela", side: "receber", opening: 8000, ownership: "own" },
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
        opening: 89200,
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
