import { describe, expect, it } from "vitest";
import {
  companyMonthOutlook,
  recurringPlanned,
  unitEconomics,
} from "./engine";
import { migrate } from "./persist";
import { seedState } from "./seed";
import type { AppState } from "./types";
import { SCHEMA_VERSION } from "./types";

describe("Gestão empresas — recorrentes + outlook", () => {
  it("seed PDS tem funcionário planeado; Plural tem custos por produto", () => {
    const s = seedState();
    expect(recurringPlanned(s, "cw")).toBe(35_000);
    expect(recurringPlanned(s, "rove")).toBe(12_000 + 25_000);
    expect(unitEconomics(s, "netflix").perClientCost).toBeGreaterThan(0);
    expect(unitEconomics(s, "iptv").perClientCost).toBeGreaterThan(0);
  });

  it("lucro esperado desconta planeado ainda não registado", () => {
    let s = seedState();
    s = {
      ...s,
      movements: [
        ...s.movements,
        {
          id: "m-test-rec",
          at: `${s.month}-10`,
          kind: "receita",
          amount: 100_000,
          from: { type: "world" },
          to: { type: "liquidity", id: "cw-caixa" },
          entityId: "cw",
          category: "jogos",
        },
      ],
    };
    const o = companyMonthOutlook(s, "cw");
    expect(o.receita).toBe(100_000);
    expect(o.desp).toBe(0);
    expect(o.planned).toBe(35_000);
    expect(o.porRegistar).toBe(35_000);
    expect(o.lucroEsperado).toBe(65_000); // 100k − max(0, 35k)
    expect(o.lucroRegistado).toBe(100_000); // ainda sem despesas no ledger
  });

  it("migrate acrescenta recorrentes Plural em falta e active", () => {
    const legacy = {
      ...seedState(),
      schemaVersion: 7,
      recurring: [{ id: "func-cw", entityId: "cw", name: "Funcionário", amount: 35000, nature: "fixo" }],
    } as unknown as AppState;
    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.recurring.find((r) => r.id === "func-cw")?.active).toBe(true);
    expect(next.recurring.some((r) => r.id === "rove-netflix")).toBe(true);
  });
});
