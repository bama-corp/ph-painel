import { describe, expect, it } from "vitest";
import {
  budgetBucketGap,
  budgetLinesTotal,
  buildDecisions,
  plannedIncomeTotal,
} from "./engine";
import { seedState } from "./seed";

describe("Linhas orçamentárias (inventário das %)", () => {
  it("gap compara linhas vs tecto da %", () => {
    const planned = plannedIncomeTotal(seedState());
    const s = {
      ...seedState(),
      budgetLines: [
        { id: "1", bucket: "obrigacoes" as const, name: "Renda", amount: 50_000, active: true },
        { id: "2", bucket: "obrigacoes" as const, name: "Luz", amount: 10_000, active: true },
        { id: "3", bucket: "obrigacoes" as const, name: "Off", amount: 99_000, active: false },
      ],
    };
    expect(budgetLinesTotal(s, "obrigacoes")).toBe(60_000);
    const g = budgetBucketGap(s, "obrigacoes");
    // ph-bolsos: 30% obrigações
    expect(g.ceiling).toBe(Math.round(planned * 0.3));
    expect(g.planned).toBe(60_000);
    expect(g.hasLines).toBe(true);
  });

  it("Decisão pede inventário se obrigações sem linhas", () => {
    const d = buildDecisions(seedState());
    expect(d.some((x) => x.id === "linhas-obrigacoes")).toBe(true);
  });

  it("Decisão avisa quando linhas passam o tecto", () => {
    const s = {
      ...seedState(),
      budgetLines: [
        {
          id: "1",
          bucket: "obrigacoes" as const,
          name: "Tudo",
          amount: 200_000,
          active: true,
        },
      ],
    };
    const d = buildDecisions(s);
    expect(d.some((x) => x.id === "tecto-obrigacoes")).toBe(true);
  });
});
