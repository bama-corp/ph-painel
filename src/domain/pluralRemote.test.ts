import { describe, expect, it } from "vitest";
import {
  applyPluralSummary,
  mapPluralClient,
  mapPluralClients,
  type PluralSummary,
} from "./pluralRemote";
import { seedState } from "./seed";

const sample: PluralSummary = {
  asOf: "2026-09-28",
  mrr: 150_000,
  lucroEstimado: 120_000,
  byServico: { netflix: 80_000, iptv: 70_000 },
  clients: [
    {
      id: "12",
      nome: "Maria",
      servico: "netflix",
      valor: 5000,
      dataFim: "2026-09-15",
      status: "ativo",
    },
    {
      id: "99",
      nome: "João",
      servico: "iptv",
      valor: 9500,
      dataFim: "2026-08-01",
      status: "vencido",
    },
    {
      id: "3",
      nome: "Ana",
      servico: "netflix",
      valor: 4500,
      dataFim: null,
      status: "cancelado",
    },
  ],
};

describe("pluralRemote", () => {
  it("mapeia id com prefixo plural- e status vencido → em_atraso", () => {
    const c = mapPluralClient(sample.clients[1]!);
    expect(c.id).toBe("plural-99");
    expect(c.name).toBe("João");
    expect(c.product).toBe("iptv");
    expect(c.price).toBe(9500);
    expect(c.nextPayment).toBe("2026-08-01");
    expect(c.dueDay).toBe(1);
    expect(c.status).toBe("em_atraso");
  });

  it("não duplica prefixo plural-", () => {
    const c = mapPluralClient({ ...sample.clients[0]!, id: "plural-12" });
    expect(c.id).toBe("plural-12");
    expect(c.status).toBe("ativo");
    expect(c.dueDay).toBe(15);
  });

  it("applyPluralSummary prefere mrrPainel e substitui clientes", () => {
    const s = seedState();
    const next = applyPluralSummary(s, { ...sample, mrrPainel: 165_000 });
    expect(next.roveClients).toHaveLength(3);
    expect(next.roveClients.map((c) => c.id)).toEqual([
      "plural-12",
      "plural-99",
      "plural-3",
    ]);
    expect(next.declared.roveRevenue).toBe(165_000);
    expect(next.declared.roveProfit).toBe(120_000);
    expect(mapPluralClients(sample)).toHaveLength(3);
  });
});
