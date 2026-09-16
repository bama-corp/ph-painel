import { describe, expect, it } from "vitest";
import {
  applyPartyCollection,
  applyPartyPayment,
  liquidityOf,
  ownerCurrent,
  partyOf,
} from "./engine";
import { seedState } from "./seed";

describe("Passo 5 — parties / dívidas", () => {
  it("pagamento Tuni reduz cash e party atomicamente", () => {
    const s = seedState();
    const cashBefore = liquidityOf(s, "bai");
    const dueBefore = partyOf(s, "tuni-pag");
    expect(dueBefore).toBe(60_000);

    const r = applyPartyPayment(s, {
      partyId: "tuni-pag",
      accountId: "bai",
      amount: 10_000,
      id: "pay-tuni",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liquidityOf(r.state, "bai")).toBeCloseTo(cashBefore - 10_000, 2);
    expect(partyOf(r.state, "tuni-pag")).toBe(50_000);
    expect(r.movement.kind).toBe("pagamento_party");
  });

  it("não permite pagar mais do que a dívida", () => {
    const s = seedState();
    const r = applyPartyPayment(s, {
      partyId: "tuni-pag",
      accountId: "bai",
      amount: 100_000,
    });
    expect(r.ok).toBe(false);
  });

  it("Lenu custody: pagamento reduz custódia sem misturar ownership", () => {
    const s = seedState();
    const before = partyOf(s, "lenu");
    const r = applyPartyPayment(s, {
      partyId: "lenu",
      accountId: "stand",
      amount: 37_600,
      id: "pay-lenu",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(partyOf(r.state, "lenu")).toBe(before - 37_600);
    expect(r.state.parties.find((p) => p.id === "lenu")?.ownership).toBe("custody");
  });

  it("cobrança Ferraz reduz a receber e aumenta liquidez", () => {
    const s = seedState();
    const due = partyOf(s, "ferraz");
    const cash = liquidityOf(s, "bai");
    const r = applyPartyCollection(s, {
      partyId: "ferraz",
      accountId: "bai",
      amount: 5_000,
      id: "cob-ferraz",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(partyOf(r.state, "ferraz")).toBe(due - 5_000);
    expect(liquidityOf(r.state, "bai")).toBeCloseTo(cash + 5_000, 2);
  });

  it("owner_current via role — não só id emanuel-cw", () => {
    const s = seedState();
    const p = s.parties.find((x) => x.role === "owner_current");
    expect(p?.id).toBe("emanuel-cw");
    expect(ownerCurrent(s)).toBe(0);
  });

  it("pagamento rejeitado em party a receber (usar cobrança)", () => {
    const s = seedState();
    const r = applyPartyPayment(s, {
      partyId: "ferraz",
      accountId: "bai",
      amount: 1000,
    });
    expect(r.ok).toBe(false);
  });
});
