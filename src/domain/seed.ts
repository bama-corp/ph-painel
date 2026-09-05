import type { AppState } from "./types";

/**
 * Snapshot de 19 ago 2026 (resumo_financeiro_atual).
 * Empresas: PDS, Plural, Picasso's, PH (36.500 — linha BAMA no resumo).
 * Lenu e Eduardo (GTA) são dinheiro de terceiros dentro da liquidez pessoal.
 */
export function seedState(): AppState {
  return {
    asOf: "2026-08-19",
    month: "2026-08",
    rules: {
      obrigacoes: 30,
      reserva: 20,
      investimento: 20,
      despesas: 20,
      lazer: 10,
    },
    accounts: [
      { id: "bai", entityId: "pessoal", name: "BAI", kind: "banco", opening: 111303.02 },
      { id: "bfa", entityId: "pessoal", name: "BFA", kind: "banco", opening: 10107.06 },
      { id: "atlantico", entityId: "pessoal", name: "ATLANTICO — teu", kind: "banco", opening: 59500 },
      { id: "stand", entityId: "pessoal", name: "STAND", kind: "stand", opening: 1000000 },
      { id: "caixa-p", entityId: "pessoal", name: "Caixa", kind: "caixa", opening: 1800 },
      { id: "cofre", entityId: "pessoal", name: "Cofre", kind: "cofre", opening: 0 },
      { id: "cw-caixa", entityId: "cw", name: "Caixa PDS", kind: "caixa", opening: 12310 },
      { id: "cw-bai2", entityId: "cw", name: "BAI 2", kind: "banco", opening: 57250 },
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
      { id: "gsa", entityId: "pessoal", name: "GSA — Jun/jul (pago)", side: "receber", opening: 0 },
      { id: "ferraz", entityId: "pessoal", name: "Chefe Ferraz", side: "receber", opening: 55000 },
      { id: "bt", entityId: "pessoal", name: "BT", side: "receber", opening: 34000 },
      { id: "nuno", entityId: "pessoal", name: "Nuno", side: "receber", opening: 8000 },
      { id: "daniela", entityId: "pessoal", name: "Daniela", side: "receber", opening: 8000 },
      { id: "tuni-pag", entityId: "pessoal", name: "Tuni", side: "pagar", opening: 60000 },
      { id: "meneza", entityId: "pessoal", name: "Meneza (pago)", side: "pagar", opening: 0 },
      { id: "lenu", entityId: "pessoal", name: "Lenu (terceiros)", side: "pagar", opening: 437600 },
      { id: "eduardo-gta", entityId: "pessoal", name: "Eduardo — GTA 6 (terceiros)", side: "pagar", opening: 43316 },
      { id: "emanuel-cw", entityId: "cw", name: "Emanuel — conta corrente", side: "receber", opening: 0, linkedEntityId: "pessoal" },
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
      { id: "func-cw", entityId: "cw", name: "Funcionário", amount: 35000, nature: "fixo" },
      { id: "salario", entityId: "pessoal", name: "Salário GSA", amount: 220000, nature: "fixo" },
    ],
    declared: {
      cwRevenueJuly: 86460,
      roveRevenue: 83500,
      roveProfit: 29000,
      salary: 220000,
    },
  };
}
