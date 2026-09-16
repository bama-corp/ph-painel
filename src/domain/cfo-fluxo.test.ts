import { describe, expect, it } from "vitest";
import {
  applyAddMovement,
  applyAllocate,
  applyPartyPayment,
  buildDecisions,
  cfoMetrics,
  fluxoMes,
  spendablePersonal,
} from "./engine";
import { seedState } from "./seed";

describe("Passo 6 — CFO / Decisão", () => {
  it("cfoMetrics distingue gastável, custódia, empresa, dívida própria vs terceiros", () => {
    const s = seedState();
    const m = cfoMetrics(s);
    expect(m.custodia).toBe(437600 + 43316);
    expect(m.dividaPropria).toBe(60_000); // Tuni
    expect(m.dividaTerceiros).toBe(m.custodia);
    expect(m.empresa).toBeGreaterThan(0);
    expect(m.gastavel).toBe(0);
    expect(m.alocavel).toBe(m.liquidezPropria);
    expect(m.patrimonioLiquido).not.toBe(m.gastavel);
  });

  it("Quanto posso gastar? usa só spendablePersonal, nunca liquidez bruta", () => {
    let s = seedState();
    const funded = applyAllocate(s, [
      { envelopeId: "operacional", amount: 40_000 },
      { envelopeId: "lazer", amount: 10_000 },
    ]);
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    s = funded.state;
    // esgotar alocável restante com reserva para isolar gastável
    const rest = applyAllocate(s, [{ envelopeId: "reserva", amount: cfoMetrics(s).alocavel }]);
    expect(rest.ok).toBe(true);
    if (!rest.ok) return;
    s = rest.state;

    const m = cfoMetrics(s);
    expect(m.alocavel).toBe(0);
    expect(m.gastavel).toBe(50_000);
    expect(spendablePersonal(s)).toBe(50_000);

    const gastar = buildDecisions(s).find((d) => d.question === "Quanto posso gastar?");
    expect(gastar?.answer).toContain("50");
    expect(gastar?.detail).not.toMatch(/património líquido.*teto de gasto/i);
  });

  it("decisão não trata custódia Lenu como dívida própria prioritária misturada", () => {
    const s = seedState();
    const divida = buildDecisions(s).find((d) => d.question.includes("dívida"));
    expect(divida?.detail).toMatch(/Custódia de terceiros/i);
    expect(divida?.answer).toMatch(/Tuni|própria/i);
  });
});

describe("Passo 7 — fluxo mensal", () => {
  it("entradas reais ≠ salário declarado", () => {
    const s = seedState();
    const f = fluxoMes(s);
    expect(f.entradas).toBe(0);
    expect(f.salarioDeclarado).toBe(220_000);
    expect(f.entradas).not.toBe(f.salarioDeclarado);
  });

  it("separa despesas, transferências, investimentos, dívidas, interempresa", () => {
    let s = seedState();
    const alloc = applyAllocate(s, [{ envelopeId: "operacional", amount: 5000 }]);
    expect(alloc.ok).toBe(true);
    if (!alloc.ok) return;
    s = alloc.state;

    const despesa = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 1000,
      from: { type: "liquidity", id: "bai" },
      to: { type: "world" },
      entityId: "pessoal",
      envelopeId: "operacional",
    });
    expect(despesa.ok).toBe(true);
    if (!despesa.ok) return;
    s = despesa.state;

    const tr = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "transferencia",
      amount: 200,
      from: { type: "liquidity", id: "bai" },
      to: { type: "liquidity", id: "bfa" },
      entityId: "pessoal",
    });
    expect(tr.ok).toBe(true);
    if (!tr.ok) return;
    s = tr.state;

    const pay = applyPartyPayment(s, {
      partyId: "tuni-pag",
      accountId: "bai",
      amount: 5000,
      at: "2026-08-20",
    });
    expect(pay.ok).toBe(true);
    if (!pay.ok) return;
    s = pay.state;

    const f = fluxoMes(s, "2026-08");
    expect(f.despesas).toBe(1000);
    expect(f.transferencias).toBe(200);
    expect(f.dividasPagas).toBe(5000);
    expect(f.investimentos).toBe(0);
    expect(f.interempresa).toBe(0);
  });
});
