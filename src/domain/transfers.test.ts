import { describe, expect, it } from "vitest";
import {
  applyAddMovement,
  applyAllocate,
  envelopeOf,
  liquidityOf,
  validateMovement,
} from "./engine";
import { seedState } from "./seed";

describe("Passo 4 — transferências e invariantes de movimento", () => {
  it("transferencia same-entity é aceite (BAI → BFA)", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "transferencia",
      amount: 1000,
      from: { type: "liquidity", id: "bai" },
      to: { type: "liquidity", id: "bfa" },
      entityId: "pessoal",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liquidityOf(r.state, "bai")).toBeCloseTo(liquidityOf(s, "bai") - 1000, 2);
    expect(liquidityOf(r.state, "bfa")).toBeCloseTo(liquidityOf(s, "bfa") + 1000, 2);
  });

  it("transferencia cross-entity é rejeitada (BAI pessoal → Caixa PDS)", () => {
    const s = seedState();
    const draft = {
      at: "2026-08-20",
      kind: "transferencia" as const,
      amount: 1000,
      from: { type: "liquidity" as const, id: "bai" },
      to: { type: "liquidity" as const, id: "cw-caixa" },
      entityId: "pessoal" as const,
    };
    expect(validateMovement(s, draft)).toMatch(/cross-entity/i);
    const r = applyAddMovement(s, draft);
    expect(r.ok).toBe(false);
    expect(liquidityOf(r.state, "bai")).toBe(liquidityOf(s, "bai"));
  });

  it("PDS same-entity transferencia aceite (Caixa PDS → BAI 2)", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "transferencia",
      amount: 500,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "liquidity", id: "cw-bai2" },
      entityId: "cw",
    });
    expect(r.ok).toBe(true);
  });

  it("despesa pessoal exige pocket", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 100,
      from: { type: "liquidity", id: "bai" },
      to: { type: "world" },
      entityId: "pessoal",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/bolso/i);
  });

  it("pocket negativo é rejeitado", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 50,
      from: { type: "liquidity", id: "bai" },
      to: { type: "world" },
      entityId: "pessoal",
      envelopeId: "lazer",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/insuficiente|negativo/i);
  });

  it("despesa pessoal aceite com bolso financiado", () => {
    let s = seedState();
    const funded = applyAllocate(s, [{ envelopeId: "lazer", amount: 200 }]);
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    s = funded.state;
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 50,
      from: { type: "liquidity", id: "bai" },
      to: { type: "world" },
      entityId: "pessoal",
      envelopeId: "lazer",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(envelopeOf(r.state, "lazer")).toBe(150);
  });

  it("investimento proprietário sai do pocket investimento", () => {
    let s = seedState();
    const funded = applyAllocate(s, [{ envelopeId: "investimento", amount: 5000 }]);
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    s = funded.state;
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "investimento_proprietario",
      amount: 2000,
      from: { type: "liquidity", id: "bai" },
      to: { type: "liquidity", id: "cw-caixa" },
      entityId: "pessoal",
      otherEntityId: "cw",
      envelopeId: "investimento",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(envelopeOf(r.state, "investimento")).toBe(3000);
  });

  it("investimento proprietário sem saldo no bolso é rejeitado", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "investimento_proprietario",
      amount: 2000,
      from: { type: "liquidity", id: "bai" },
      to: { type: "liquidity", id: "ph-caixa" },
      entityId: "pessoal",
      otherEntityId: "ph",
      envelopeId: "investimento",
    });
    expect(r.ok).toBe(false);
  });
});
