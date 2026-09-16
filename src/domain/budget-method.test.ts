import { describe, expect, it } from "vitest";
import {
  applySplitMethodRules,
  detectBudgetMethodId,
  SPLIT_METHODS,
} from "./definicaoRules";
import { partsFromRules, rulesOk } from "./engine";

describe("Métodos de divisão orçamentária", () => {
  it("todos os métodos têm soma 100%", () => {
    for (const m of SPLIT_METHODS) {
      expect(rulesOk(m.rules)).toBe(true);
    }
  });

  it("50-30-20 mapeia para bolsos PH e partsFromRules", () => {
    const applied = applySplitMethodRules("50-30-20");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.rules).toEqual({
      obrigacoes: 30,
      despesas: 20,
      lazer: 30,
      reserva: 10,
      investimento: 10,
    });
    const parts = partsFromRules(100_000, applied.rules);
    const byId = Object.fromEntries(parts.map((p) => [p.envelopeId, p.amount]));
    expect(byId.operacional).toBe(50_000); // 30+20
    expect(byId.lazer).toBe(30_000);
    expect(byId.reserva).toBe(10_000);
    expect(byId.investimento).toBe(10_000);
  });

  it("detectBudgetMethodId reconhece ph-bolsos e custom", () => {
    expect(detectBudgetMethodId(SPLIT_METHODS.find((m) => m.id === "ph-bolsos")!.rules)).toBe(
      "ph-bolsos",
    );
    expect(
      detectBudgetMethodId({
        obrigacoes: 10,
        reserva: 10,
        investimento: 10,
        despesas: 10,
        lazer: 60,
      }),
    ).toBe("custom");
  });
});
