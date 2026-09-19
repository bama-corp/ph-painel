/**
 * Adversarial harness — buracos C1–H8 fechados: esperam rejeição / invariante.
 */
import { describe, expect, it } from "vitest";
import {
  applyAddMovement,
  applyAllocate,
  allocatablePersonal,
  buildDecisions,
  cfoMetrics,
  custodyLiquidity,
  liquidityOf,
  netWorth,
  partyOf,
  personalOwnLiquidity,
  spendablePersonal,
} from "./engine";
import { seedState } from "./seed";

describe("ADVERSARIAL — buracos fechados", () => {
  it("SEED métricas base", () => {
    const m = cfoMetrics(seedState());
    expect(m.liquidezBrutaPessoal).toBeCloseTo(1_182_710.08, 2);
    expect(m.custodia).toBe(480_916);
    expect(m.liquidezPropria).toBeCloseTo(701_794.08, 2);
    expect(m.alocavel).toBeCloseTo(701_794.08, 2);
    expect(m.gastavel).toBe(0);
  });

  it("FIXED C1: receita + envelopeId rejeitada (não inventa spendable)", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "receita",
      amount: 50_000,
      from: { type: "world" },
      to: { type: "world" },
      entityId: "pessoal",
      envelopeId: "lazer",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/não aloca|bolsos/i);
    expect(spendablePersonal(s)).toBe(0);
  });

  it("FIXED C2: alocacao via applyAddMovement rejeitada", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "alocacao",
      amount: 999_999_999,
      from: { type: "unallocated" },
      to: { type: "envelope", id: "lazer" },
      entityId: "pessoal",
      envelopeId: "lazer",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/Meter|applyAllocate/i);
    expect(spendablePersonal(s)).toBe(0);
  });

  it("FIXED C3: ajuste from party rejeitado", () => {
    const s = seedState();
    const ownBefore = personalOwnLiquidity(s);
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "ajuste",
      amount: 437_600,
      from: { type: "party", id: "lenu" },
      to: { type: "world" },
      entityId: "pessoal",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/pagamento_party|cobranca_party|Parties/i);
    expect(partyOf(s, "lenu")).toBe(437_600);
    expect(personalOwnLiquidity(s)).toBeCloseTo(ownBefore, 2);
  });

  it("FIXED C4: despesa from party rejeitada", () => {
    const funded = applyAllocate(seedState(), [{ envelopeId: "operacional", amount: 60_000 }]);
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    const r = applyAddMovement(funded.state, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 60_000,
      from: { type: "party", id: "tuni-pag" },
      to: { type: "world" },
      entityId: "pessoal",
      envelopeId: "operacional",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/pagamento_party|cobranca_party|Parties/i);
    expect(partyOf(funded.state, "tuni-pag")).toBe(60_000);
  });

  it("FIXED C5: despesa empresa sem overdraft", () => {
    const s = seedState();
    const cash = liquidityOf(s, "cw-caixa");
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 999_999,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "world" },
      entityId: "cw",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/insuficiente/i);
    expect(liquidityOf(s, "cw-caixa")).toBe(cash);
  });

  it("FIXED C6: emprestimo from party rejeitado", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "emprestimo_proprietario",
      amount: 1_000,
      from: { type: "party", id: "emanuel-cw" },
      to: { type: "liquidity", id: "caixa-p" },
      entityId: "cw",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/Parties|liquidez/i);
    expect(liquidityOf(s, "caixa-p")).toBe(liquidityOf(seedState(), "caixa-p"));
  });

  it("FIXED C7: receita company→pessoal rejeitada", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "receita",
      amount: 5_000,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "liquidity", id: "caixa-p" },
      entityId: "pessoal",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/cross-entity/i);
    expect(liquidityOf(s, "cw-caixa")).toBe(liquidityOf(seedState(), "cw-caixa"));
    expect(spendablePersonal(s)).toBe(0);
  });

  it("FIXED H8: emprestimo liquidez→liquidez não inflaciona netWorth", () => {
    const s = seedState();
    const nw0 = netWorth(s);
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "emprestimo_proprietario",
      amount: 10_000,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "liquidity", id: "caixa-p" },
      entityId: "cw",
      otherEntityId: "pessoal",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(partyOf(r.state, "emanuel-cw")).toBe(99_200);
    expect(netWorth(r.state)).toBeCloseTo(nw0, 2);
  });

  it("CONTROLO: applyAllocate NÃO permite meter custody (tecto = own)", () => {
    const s = seedState();
    const r = applyAllocate(s, [
      { envelopeId: "lazer", amount: allocatablePersonal(s) + custodyLiquidity(s) },
    ]);
    expect(r.ok).toBe(false);
  });

  it("CONTROLO: CFO seed — gastável 0; fila pede alocar primeiro", () => {
    const decisions = buildDecisions(seedState());
    expect(decisions[0]?.id).toBe("alocar");
    expect(cfoMetrics(seedState()).gastavel).toBe(0);
  });
});
