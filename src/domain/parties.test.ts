import { describe, expect, it } from "vitest";
import {
  applyPartyCollection,
  applyPartyPayment,
  custodyInAccount,
  liquidityOf,
  ownLiquidityOf,
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
    expect(ownerCurrent(s)).toBe(89_200);
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

  it("ownLiquidityOf = saldo − custódia marcada nessa conta", () => {
    const s = seedState();
    expect(custodyInAccount(s, "atlantico")).toBe(437600 + 43316);
    expect(ownLiquidityOf(s, "atlantico")).toBe(0);
    expect(ownLiquidityOf(s, "bai")).toBe(liquidityOf(s, "bai"));
  });

  it("devolver custódia mantém o «teu» na conta", () => {
    let s = seedState();
    s = {
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === "atlantico" ? { ...a, opening: 500_000 } : a,
      ),
      parties: s.parties.map((p) =>
        p.id === "lenu"
          ? { ...p, opening: 100_000, heldInAccountId: "atlantico" }
          : p.id === "eduardo-gta"
            ? { ...p, opening: 50_000, heldInAccountId: "atlantico" }
            : p,
      ),
    };
    const teuAntes = ownLiquidityOf(s, "atlantico");
    expect(teuAntes).toBe(350_000);
    const r = applyPartyPayment(s, {
      partyId: "lenu",
      accountId: "atlantico",
      amount: 40_000,
      id: "dev-lenu",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ownLiquidityOf(r.state, "atlantico")).toBe(teuAntes);
    expect(liquidityOf(r.state, "atlantico")).toBe(460_000);
    expect(custodyInAccount(r.state, "atlantico")).toBe(110_000);
  });
});
