import { describe, expect, it } from "vitest";
import { liquidityOf, partyOf } from "./engine";
import { exportStateJson, migrate } from "./persist";
import {
  ACCOUNT_SNAPSHOT,
  OTHER_COMPANY_LIVE_SNAPSHOT,
  PDS_LIVE_SNAPSHOT,
  PERSONAL_LIVE_SNAPSHOT,
  seedState,
} from "./seed";
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
    expect(next.accounts.find((a) => a.id === "cw-bai2")?.opening).toBe(29772.33);
    // v9 mete 89.200; v14 limpa de novo.
    expect(next.parties.find((p) => p.id === "emanuel-cw")?.opening).toBe(0);
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

  it("migrate tira «— teu» do ATLANTICO e Cofre → Carteira", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: SCHEMA_VERSION,
      accounts: base.accounts.map((a) => {
        if (a.id === "atlantico") return { ...a, name: "ATLANTICO — teu" };
        if (a.id === "cofre") return { ...a, name: "Cofre" };
        return a;
      }),
    };

    const next = migrate(legacy);
    expect(next.accounts.find((a) => a.id === "atlantico")?.name).toBe("ATLANTICO");
    expect(next.accounts.find((a) => a.id === "cofre")?.name).toBe("Carteira");
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

  it("migrate v15→v16 desaloca os bolsos", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 15,
      movements: [
        {
          id: "a-lazer",
          at: "2026-10-01",
          kind: "alocacao" as const,
          amount: 12_000,
          from: { type: "unallocated" as const },
          to: { type: "envelope" as const, id: "lazer" },
          entityId: "pessoal" as const,
          envelopeId: "lazer",
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.movements.some((m) => m.note === "Desalocação de bolso")).toBe(true);
    const lazer = next.movements.filter((m) => m.envelopeId === "lazer");
    const inLazer = lazer
      .filter((m) => m.to.type === "envelope")
      .reduce((s, m) => s + m.amount, 0);
    const outLazer = lazer
      .filter((m) => m.from.type === "envelope")
      .reduce((s, m) => s + m.amount, 0);
    expect(inLazer - outLazer).toBe(0);
  });

  it("migrate v16→v17 faz o saldo vivo coincidir com o extracto", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 16,
      movements: [
        {
          id: "m-old-bai",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 12_000,
          from: { type: "liquidity" as const, id: "bai" },
          to: { type: "world" as const },
          entityId: "pessoal" as const,
        },
      ],
    } as unknown as AppState;

    expect(liquidityOf(legacy, "bai")).toBe(ACCOUNT_SNAPSHOT.bai - 12_000);
    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(liquidityOf(next, "bai")).toBe(ACCOUNT_SNAPSHOT.bai);
    expect(liquidityOf(next, "cw-caixa")).toBe(ACCOUNT_SNAPSHOT["cw-caixa"]);
    expect(next.movements.some((m) => m.id === "ajuste-v17-bai")).toBe(true);
  });

  it("migrate v17→v18 corrige só o Total pessoal, sem mexer na custódia", () => {
    const base = seedState();
    const lenuBefore = base.parties.find((p) => p.id === "lenu");
    const legacy = {
      ...base,
      schemaVersion: 17,
      movements: [
        {
          id: "m-old-stand",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 50_000,
          from: { type: "liquidity" as const, id: "stand" },
          to: { type: "world" as const },
          entityId: "pessoal" as const,
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(liquidityOf(next, "stand")).toBe(PERSONAL_LIVE_SNAPSHOT.stand);
    const lenuAfter = next.parties.find((p) => p.id === "lenu");
    expect(lenuAfter?.ownership).toBe(lenuBefore?.ownership);
    expect(lenuAfter?.heldInAccountId).toBe(lenuBefore?.heldInAccountId);
    expect(next.accounts.find((a) => a.id === "stand")?.opening).toBe(base.accounts.find((a) => a.id === "stand")?.opening);
  });

  it("migrate v18→v19 corrige o Total da PDS", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 18,
      movements: [
        {
          id: "m-old-cw",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 8_000,
          from: { type: "liquidity" as const, id: "cw-caixa" },
          to: { type: "world" as const },
          entityId: "cw" as const,
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(liquidityOf(next, "cw-caixa")).toBe(PDS_LIVE_SNAPSHOT["cw-caixa"]);
    expect(liquidityOf(next, "cw-bai2")).toBe(PDS_LIVE_SNAPSHOT["cw-bai2"]);
    expect(next.accounts.find((a) => a.id === "cw-caixa")?.opening).toBe(
      base.accounts.find((a) => a.id === "cw-caixa")?.opening,
    );
  });

  it("migrate v19→v20 corrige Plural, Picasso's e PH", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 19,
      movements: [
        {
          id: "m-old-rove",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 5_000,
          from: { type: "liquidity" as const, id: "rove-caixa" },
          to: { type: "world" as const },
          entityId: "rove" as const,
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(liquidityOf(next, "rove-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["rove-caixa"]);
    expect(liquidityOf(next, "picasso-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["picasso-caixa"]);
    expect(liquidityOf(next, "ph-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["ph-caixa"]);
  });

  it("migrate v20→v21 corrige Caixa actual de Plural, Picasso's e PH", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 20,
      movements: [
        {
          id: "m-old-ph",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 10_000,
          from: { type: "liquidity" as const, id: "ph-caixa" },
          to: { type: "world" as const },
          entityId: "ph" as const,
        },
        {
          id: "m-old-picasso",
          at: "2026-10-15",
          kind: "despesa" as const,
          amount: 4_000,
          from: { type: "liquidity" as const, id: "picasso-caixa" },
          to: { type: "world" as const },
          entityId: "picasso" as const,
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(liquidityOf(next, "rove-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["rove-caixa"]);
    expect(liquidityOf(next, "ph-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["ph-caixa"]);
    expect(liquidityOf(next, "picasso-caixa")).toBe(OTHER_COMPANY_LIVE_SNAPSHOT["picasso-caixa"]);
  });

  it("migrate v21→v22 actualiza só a dívida Lenu para 232.500", () => {
    const base = seedState();
    const atlanticoBefore = liquidityOf(base, "atlantico");
    const legacy = {
      ...base,
      schemaVersion: 21,
      parties: base.parties.map((p) =>
        p.id === "lenu"
          ? { ...p, opening: 1_112_500, ownership: "own" as const, heldInAccountId: undefined, side: "receber" as const }
          : p,
      ),
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(partyOf(next, "lenu")).toBe(232_500);
    expect(next.parties.find((p) => p.id === "lenu")?.opening).toBe(232_500);
    expect(next.parties.find((p) => p.id === "lenu")?.ownership).toBe("own");
    expect(liquidityOf(next, "atlantico")).toBe(atlanticoBefore);
    expect(next.parties.find((p) => p.id === "eduardo-gta")?.opening).toBe(
      base.parties.find((p) => p.id === "eduardo-gta")?.opening,
    );
  });

  it("migrate v22→v23 remove Nuno e Daniela", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 22,
      parties: [
        ...base.parties,
        { id: "nuno", entityId: "pessoal" as const, name: "Nuno", side: "receber" as const, opening: 8000, ownership: "own" as const },
        { id: "daniela", entityId: "pessoal" as const, name: "Daniela", side: "receber" as const, opening: 8000, ownership: "own" as const },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.parties.find((p) => p.id === "nuno")).toBeUndefined();
    expect(next.parties.find((p) => p.id === "daniela")).toBeUndefined();
    expect(next.parties.some((p) => /^nuno$/i.test(p.name) || /^daniela$/i.test(p.name))).toBe(false);
    expect(next.removedPartyIds).toEqual(expect.arrayContaining(["nuno", "daniela"]));
    expect(next.parties.find((p) => p.id === "ferraz")).toBeTruthy();
  });

  it("migrate v23→v24 elimina a custódia PDS, sem mexer nas contas", () => {
    const base = seedState();
    const baiBefore = liquidityOf(base, "bai");
    const legacy = {
      ...base,
      schemaVersion: 23,
      parties: [
        ...base.parties,
        {
          id: "pds-cust",
          entityId: "pessoal" as const,
          name: "PDS",
          side: "pagar" as const,
          opening: 65184.8,
          ownership: "custody" as const,
          heldInAccountId: "bai",
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.parties.find((p) => p.id === "pds-cust")).toBeUndefined();
    expect(next.parties.some((p) => p.ownership === "custody" && /^pds$/i.test(p.name))).toBe(false);
    expect(next.removedPartyIds).toContain("pds-cust");
    expect(next.parties.find((p) => p.id === "lenu")?.ownership).toBe("custody");
    expect(next.parties.find((p) => p.id === "eduardo-gta")?.ownership).toBe("custody");
    expect(liquidityOf(next, "bai")).toBe(baiBefore);
  });

  it("migrate v24→v25 elimina a custódia Tuni, sem mexer nas contas nem na dívida própria", () => {
    const base = seedState();
    const standBefore = liquidityOf(base, "stand");
    const legacy = {
      ...base,
      schemaVersion: 24,
      parties: [
        ...base.parties,
        {
          id: "tuni-cust",
          entityId: "pessoal" as const,
          name: "Tuni",
          side: "pagar" as const,
          opening: 36_000,
          ownership: "custody" as const,
          heldInAccountId: "stand",
        },
      ],
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.parties.find((p) => p.id === "tuni-cust")).toBeUndefined();
    expect(next.parties.some((p) => p.ownership === "custody" && /^tuni$/i.test(p.name))).toBe(false);
    expect(next.removedPartyIds).toContain("tuni-cust");
    expect(next.parties.find((p) => p.id === "tuni-pag")?.ownership).toBe("own");
    expect(next.parties.find((p) => p.id === "lenu")?.ownership).toBe("custody");
    expect(liquidityOf(next, "stand")).toBe(standBefore);
  });

  it("migrate v14→v15 aplica snapshot das contas", () => {
    const base = seedState();
    const legacy = {
      ...base,
      schemaVersion: 14,
      accounts: base.accounts.map((a) => {
        if (a.id === "bai") return { ...a, name: "BAI", opening: 111303.02 };
        if (a.id === "cw-caixa") return { ...a, opening: 29060 };
        if (a.id === "stand") return { ...a, name: "STAND", opening: 1_000_000 };
        return a;
      }),
    } as unknown as AppState;

    const next = migrate(legacy);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.accounts.find((a) => a.id === "bai")?.opening).toBe(880000);
    expect(next.accounts.find((a) => a.id === "bai")?.name).toBe("BAI 1");
    expect(next.accounts.find((a) => a.id === "cw-caixa")?.opening).toBe(46210);
    expect(next.accounts.find((a) => a.id === "cw-bai2")?.opening).toBe(29772.33);
    expect(next.accounts.find((a) => a.id === "stand")?.opening).toBe(1775.25);
    expect(next.accounts.find((a) => a.id === "stand")?.name).toBe("STANDARD");
    expect(next.accounts.find((a) => a.id === "ph-caixa")?.opening).toBe(63500);
  });

  it("export JSON inclui schemaVersion e preserva seed numbers", () => {
    const s = seedState();
    const json = exportStateJson(s);
    const parsed = JSON.parse(json) as AppState & { exportedAt?: string };
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.parties.find((p) => p.id === "lenu")?.opening).toBe(437600);
    expect(parsed.accounts.find((a) => a.id === "stand")?.opening).toBe(1775.25);
    expect(parsed.incomeSources?.[0]?.amount).toBe(220_000);
    expect(parsed.accounts.find((a) => a.id === "bai2-p")).toBeUndefined();
  });
});
