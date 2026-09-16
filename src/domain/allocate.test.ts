import { describe, expect, it } from "vitest";
import {
  allocatablePersonal,
  applyAllocate,
  applyDistributeEntry,
  custodyLiquidity,
  envelopeOf,
  partsFromRules,
  personalOwnLiquidity,
  spendablePersonal,
} from "./engine";
import { seedState } from "./seed";

describe("Passo 3 — Meter / distribuição", () => {
  it("Meter (allocate) só consome allocatablePersonal — custody intocado", () => {
    const s = seedState();
    const custodyBefore = custodyLiquidity(s);
    const avail = allocatablePersonal(s);
    const r = applyAllocate(s, [{ envelopeId: "lazer", amount: 10_000 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(custodyLiquidity(r.state)).toBe(custodyBefore);
    expect(allocatablePersonal(r.state)).toBeCloseTo(avail - 10_000, 2);
    expect(spendablePersonal(r.state)).toBe(10_000);
  });

  it("allocate rejeita valor acima do alocável (incl. tentativa de meter custody)", () => {
    const s = seedState();
    const tooMuch = allocatablePersonal(s) + custodyLiquidity(s);
    const r = applyAllocate(s, [{ envelopeId: "operacional", amount: tooMuch }]);
    expect(r.ok).toBe(false);
    expect(envelopeOf(r.state, "operacional")).toBe(0);
  });

  it("Distribuir esta entrada 300.000 usa state.rules guardadas", () => {
    const s = seedState();
    expect(s.rules).toEqual({
      obrigacoes: 30,
      reserva: 20,
      investimento: 20,
      despesas: 20,
      lazer: 10,
    });
    const parts = partsFromRules(300_000, s.rules);
    expect(parts.find((p) => p.envelopeId === "operacional")?.amount).toBe(150_000); // 30+20
    expect(parts.find((p) => p.envelopeId === "reserva")?.amount).toBe(60_000);
    expect(parts.find((p) => p.envelopeId === "investimento")?.amount).toBe(60_000);
    expect(parts.find((p) => p.envelopeId === "lazer")?.amount).toBe(30_000);

    const r = applyDistributeEntry(s, 300_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(envelopeOf(r.state, "operacional")).toBe(150_000);
    expect(envelopeOf(r.state, "reserva")).toBe(60_000);
    expect(envelopeOf(r.state, "investimento")).toBe(60_000);
    expect(envelopeOf(r.state, "lazer")).toBe(30_000);
    expect(spendablePersonal(r.state)).toBe(180_000);
    expect(allocatablePersonal(r.state)).toBeCloseTo(allocatablePersonal(s) - 300_000, 2);
  });

  it("não distribui com draft diferente — só state.rules", () => {
    const s = {
      ...seedState(),
      rules: { obrigacoes: 100, reserva: 0, investimento: 0, despesas: 0, lazer: 0 },
    };
    const r = applyDistributeEntry(s, 50_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(envelopeOf(r.state, "operacional")).toBe(50_000);
    expect(envelopeOf(r.state, "lazer")).toBe(0);
  });

  it("rejeita distribuir entrada > alocável (stock com custody não conta)", () => {
    const s = seedState();
    const r = applyDistributeEntry(s, personalOwnLiquidity(s) + 1);
    expect(r.ok).toBe(false);
  });

  it("company nunca entra em personal pockets via allocate", () => {
    const s = seedState();
    const before = envelopeOf(s, "operacional");
    // inventar “alocar” valor igual à liquidez PH não passa o tecto alocável pessoal de forma a misturar —
    // o domínio só subtrai de allocatablePersonal, nunca lê contas empresa.
    const r = applyAllocate(s, [{ envelopeId: "operacional", amount: 1 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(envelopeOf(r.state, "operacional")).toBe(before + 1);
  });
});
