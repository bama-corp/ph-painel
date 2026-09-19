import { describe, expect, it } from "vitest";
import { exportStateJson, migrate } from "./persist";
import { seedState } from "./seed";
import { SCHEMA_VERSION } from "./types";
import type { AppState } from "./types";

describe("Passo 8 — schema / migration / export", () => {
  it("seed tem schemaVersion actual", () => {
    expect(seedState().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("migrate preserva movimentos e acrescenta ownership", () => {
    const legacy = {
      ...seedState(),
      schemaVersion: 1,
      parties: seedState().parties.map(({ ownership: _o, role: _r, ...p }) => p),
      movements: [
        {
          id: "keep-me",
          at: "2026-08-01",
          kind: "receita" as const,
          amount: 1,
          from: { type: "world" as const },
          to: { type: "world" as const },
          entityId: "cw" as const,
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.movements.some((m) => m.id === "keep-me")).toBe(true);
    expect(next.parties.find((p) => p.id === "lenu")?.ownership).toBe("custody");
    expect(next.parties.find((p) => p.id === "emanuel-cw")?.role).toBe("owner_current");
  });

  it("migrate adiciona contas em falta sem apagar as existentes", () => {
    const partial = {
      ...seedState(),
      accounts: seedState().accounts.filter((a) => a.id !== "ph-caixa" && a.id !== "picasso-caixa"),
    };
    const next = migrate(partial);
    expect(next.accounts.some((a) => a.id === "ph-caixa")).toBe(true);
    expect(next.accounts.some((a) => a.id === "picasso-caixa")).toBe(true);
    expect(next.accounts.some((a) => a.id === "bai")).toBe(true);
  });

  it("migrate v4→v5 cria incomeSources a partir de declared.salary", () => {
    const legacy = {
      ...seedState(),
      schemaVersion: 4,
      incomeSources: undefined,
      budgetMethodId: undefined,
      declared: { ...seedState().declared, salary: 220_000 },
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.incomeSources).toHaveLength(1);
    expect(next.incomeSources[0]?.id).toBe("gsa");
    expect(next.incomeSources[0]?.amount).toBe(220_000);
    expect(next.declared.salary).toBe(220_000);
    expect(next.budgetMethodId).toBe("ph-bolsos");
    expect(next.budgetLines).toEqual([]);
  });

  it("migrate preserva budgetLines e sobe para schema 7", () => {
    const legacy = {
      ...seedState(),
      schemaVersion: 6,
      budgetLines: [
        { id: "bl1", bucket: "obrigacoes", name: "Renda", amount: 80_000, active: true },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.budgetLines).toHaveLength(1);
    expect(next.budgetLines[0]?.name).toBe("Renda");
    expect(next.budgetLines[0]?.amount).toBe(80_000);
  });

  it("migrate v8→v9 aplica BAI 2 PDS + conta corrente", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 8,
      accounts: base.accounts.map((a) =>
        a.id === "cw-bai2" ? { ...a, opening: 57_250 } : a,
      ),
      parties: base.parties.map((p) => (p.id === "emanuel-cw" ? { ...p, opening: 0 } : p)),
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.accounts.find((a) => a.id === "cw-bai2")?.opening).toBe(10_711.38);
    expect(next.parties.find((p) => p.id === "emanuel-cw")?.opening).toBe(89_200);
    expect(next.accounts.find((a) => a.id === "bai2-p")).toBeUndefined();
  });

  it("migrate v10→v11 remove BAI 2 — teu", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 10,
      accounts: [
        ...base.accounts,
        {
          id: "bai2-p",
          entityId: "pessoal" as const,
          name: "BAI 2 — teu",
          kind: "banco" as const,
          opening: 219_708,
        },
      ],
    };

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.accounts.find((a) => a.id === "bai2-p")).toBeUndefined();
  });

  it("migrate v11→v12 liga custódia ao ATLANTICO e renomeia a conta", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 11,
      accounts: base.accounts.map((a) =>
        a.id === "atlantico" ? { ...a, name: "ATLANTICO — teu" } : a,
      ),
      parties: base.parties.map((p) => {
        if (p.id !== "lenu" && p.id !== "eduardo-gta") return p;
        const { heldInAccountId: _h, ...rest } = p;
        return rest;
      }),
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.accounts.find((a) => a.id === "atlantico")?.name).toBe("ATLANTICO");
    expect(next.parties.find((p) => p.id === "lenu")?.heldInAccountId).toBe("atlantico");
    expect(next.parties.find((p) => p.id === "eduardo-gta")?.heldInAccountId).toBe("atlantico");
  });

  it("migrate não ressuscita party removida (ex. Meneza)", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 12,
      parties: [
        ...base.parties,
        {
          id: "meneza",
          entityId: "pessoal" as const,
          name: "Meneza (pago)",
          side: "pagar" as const,
          opening: 0,
          ownership: "own" as const,
        },
      ],
      removedPartyIds: ["meneza"],
    };

    const next = migrate(legacy);
    expect(next.parties.find((p) => p.id === "meneza")).toBeUndefined();
    expect(next.removedPartyIds).toContain("meneza");
  });

  it("export JSON inclui schemaVersion e preserva seed numbers", () => {
    const s = seedState();
    const json = exportStateJson(s);
    const parsed = JSON.parse(json) as AppState & { exportedAt?: string };
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.parties.find((p) => p.id === "lenu")?.opening).toBe(437600);
    expect(parsed.accounts.find((a) => a.id === "stand")?.opening).toBe(1_000_000);
    expect(parsed.incomeSources?.[0]?.amount).toBe(220_000);
    expect(parsed.accounts.find((a) => a.id === "bai2-p")).toBeUndefined();
  });
});
