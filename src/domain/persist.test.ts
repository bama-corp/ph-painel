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

  it("export JSON inclui schemaVersion e preserva seed numbers", () => {
    const s = seedState();
    const json = exportStateJson(s);
    const parsed = JSON.parse(json) as AppState & { exportedAt?: string };
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.parties.find((p) => p.id === "lenu")?.opening).toBe(437600);
    expect(parsed.accounts.find((a) => a.id === "stand")?.opening).toBe(1_000_000);
  });
});
