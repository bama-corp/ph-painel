import { describe, expect, it } from "vitest";
import {
  applyAddMovement,
  applyAllocate,
  applyPartyPayment,
  buildDecisions,
  cfoMetrics,
  fluxoMes,
  plannedIncomeTotal,
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

  it("seed: fila começa com alocar + dívida + custódia + gap renda (sem gastar ainda)", () => {
    const ids = buildDecisions(seedState()).map((d) => d.id);
    expect(ids[0]).toBe("alocar");
    expect(ids).toContain("divida-propria");
    expect(ids).toContain("custodia");
    expect(ids).not.toContain("gastar");
  });

  it("Quanto posso gastar? só aparece após alocar; usa spendablePersonal", () => {
    let s = seedState();
    const funded = applyAllocate(s, [
      { envelopeId: "operacional", amount: 40_000 },
      { envelopeId: "lazer", amount: 10_000 },
    ]);
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    s = funded.state;
    const rest = applyAllocate(s, [{ envelopeId: "reserva", amount: cfoMetrics(s).alocavel }]);
    expect(rest.ok).toBe(true);
    if (!rest.ok) return;
    s = rest.state;

    const m = cfoMetrics(s);
    expect(m.alocavel).toBe(0);
    expect(m.gastavel).toBe(50_000);
    expect(spendablePersonal(s)).toBe(50_000);

    const gastar = buildDecisions(s).find((d) => d.id === "gastar");
    expect(gastar?.answer).toContain("50");
    expect(buildDecisions(s).some((d) => d.id === "alocar")).toBe(false);
  });

  it("dívida própria na fila não mistura custódia Lenu", () => {
    const s = seedState();
    const divida = buildDecisions(s).find((d) => d.id === "divida-propria");
    expect(divida?.detail).toMatch(/Custódia de terceiros/i);
    expect(divida?.answer).toMatch(/Tuni|própria|60/i);
  });

  it("plannedIncomeTotal soma fontes activas", () => {
    const s = {
      ...seedState(),
      incomeSources: [
        { id: "gsa", name: "Salário GSA", amount: 220_000, active: true },
        { id: "free", name: "Freelance", amount: 50_000, active: true },
        { id: "off", name: "Inactiva", amount: 99_000, active: false },
      ],
    };
    expect(plannedIncomeTotal(s)).toBe(270_000);
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
      amount: 500,
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
      amount: 2000,
      at: "2026-08-20",
    });
    expect(pay.ok).toBe(true);
    if (!pay.ok) return;
    s = pay.state;

    const f = fluxoMes(s);
    expect(f.despesas).toBe(1000);
    expect(f.transferencias).toBe(500);
    expect(f.dividasPagas).toBe(2000);
  });
});
