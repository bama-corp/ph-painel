/**
 * Adversarial reproduction harness — documents holes, does NOT assert they are fixed.
 * These tests EXPECT current broken behavior where marked with `documentsHole`.
 * When holes are fixed, flip to expect rejection / invariant hold.
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

describe("ADVERSARIAL — reprodução de buracos (documentação)", () => {
  it("SEED métricas base", () => {
    const m = cfoMetrics(seedState());
    expect(m.liquidezBrutaPessoal).toBeCloseTo(1_182_710.08, 2);
    expect(m.custodia).toBe(480_916);
    expect(m.liquidezPropria).toBeCloseTo(701_794.08, 2);
    expect(m.alocavel).toBeCloseTo(701_794.08, 2);
    expect(m.gastavel).toBe(0);
  });

  it("HOLE C1: receita world→world + envelopeId inventa spendable sem cash", () => {
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
    // Documenta o buraco: hoje ACEITA
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(spendablePersonal(r.state)).toBe(50_000);
    expect(liquidityOf(r.state, "bai")).toBe(liquidityOf(s, "bai"));
  });

  it("HOLE C2: alocacao via applyAddMovement bypassa tecto allocatable", () => {
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
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(spendablePersonal(r.state)).toBe(999_999_999);
  });

  it("HOLE C3: ajuste from party Lenu limpa custody sem retirar cash → own sobe", () => {
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
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(partyOf(r.state, "lenu")).toBe(0);
    expect(liquidityOf(r.state, "stand")).toBe(liquidityOf(s, "stand"));
    expect(personalOwnLiquidity(r.state)).toBeCloseTo(ownBefore + 437_600, 2);
    expect(allocatablePersonal(r.state)).toBeCloseTo(allocatablePersonal(s) + 437_600, 2);
  });

  it("HOLE C4: despesa from party Tuni apaga dívida sem cash", () => {
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
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(partyOf(r.state, "tuni-pag")).toBe(0);
    expect(liquidityOf(r.state, "bai")).toBe(liquidityOf(funded.state, "bai"));
  });

  it("HOLE C5: despesa empresa permite overdraft (cria dinheiro negativo)", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "despesa",
      amount: 999_999,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "world" },
      entityId: "cw",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liquidityOf(r.state, "cw-caixa")).toBeLessThan(0);
  });

  it("HOLE C6: emprestimo from party→caixa-p cria cash sem sair da empresa", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "emprestimo_proprietario",
      amount: 1_000,
      from: { type: "party", id: "emanuel-cw" },
      to: { type: "liquidity", id: "caixa-p" },
      entityId: "cw",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liquidityOf(r.state, "caixa-p")).toBe(liquidityOf(s, "caixa-p") + 1_000);
    expect(liquidityOf(r.state, "cw-caixa")).toBe(liquidityOf(s, "cw-caixa"));
  });

  it("HOLE C7: company→pessoal como receita + envelope aumenta spendable", () => {
    const s = seedState();
    const r = applyAddMovement(s, {
      at: "2026-08-20",
      kind: "receita",
      amount: 5_000,
      from: { type: "liquidity", id: "cw-caixa" },
      to: { type: "liquidity", id: "caixa-p" },
      entityId: "pessoal",
      envelopeId: "operacional",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(spendablePersonal(r.state)).toBe(5_000);
    expect(liquidityOf(r.state, "cw-caixa")).toBe(liquidityOf(s, "cw-caixa") - 5_000);
    expect(liquidityOf(r.state, "caixa-p")).toBe(liquidityOf(s, "caixa-p") + 5_000);
  });

  it("HOLE H8: emprestimo_proprietario liquidez→liquidez inflaciona netWorth pessoal", () => {
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
    expect(netWorth(r.state)).toBeCloseTo(nw0 + 10_000, 2);
    expect(partyOf(r.state, "emanuel-cw")).toBe(10_000);
  });

  it("CONTROLO: applyAllocate NÃO permite meter custody (tecto = own)", () => {
    const s = seedState();
    const r = applyAllocate(s, [
      { envelopeId: "lazer", amount: allocatablePersonal(s) + custodyLiquidity(s) },
    ]);
    expect(r.ok).toBe(false);
  });

  it("CONTROLO: CFO seed — gastável 0 apesar de 1.18M bruto", () => {
    const gastar = buildDecisions(seedState()).find((d) => d.question === "Quanto posso gastar?");
    expect(gastar?.answer).toMatch(/ainda não|sem função/i);
    expect(cfoMetrics(seedState()).gastavel).toBe(0);
  });
});
