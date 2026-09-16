import { describe, expect, it } from "vitest";
import {
  allocatablePersonal,
  allocatedPersonal,
  companyLiquidity,
  custodyLiquidity,
  liquidityByEntity,
  personalGrossLiquidity,
  personalOwnLiquidity,
  spendablePersonal,
  unallocated,
} from "./engine";
import { seedState } from "./seed";
import type { AppState, Movement } from "./types";

function withMoves(state: AppState, movements: Movement[]): AppState {
  return { ...state, movements: [...state.movements, ...movements] };
}

describe("Passo 1 — ownership / métricas fundamentais", () => {
  const state = seedState();

  it("seed marca Lenu e Eduardo como custody", () => {
    expect(state.parties.find((p) => p.id === "lenu")?.ownership).toBe("custody");
    expect(state.parties.find((p) => p.id === "eduardo-gta")?.ownership).toBe("custody");
  });

  it("seed marca Tuni como own (dívida própria, não custódia)", () => {
    expect(state.parties.find((p) => p.id === "tuni-pag")?.ownership).toBe("own");
  });

  it("seed marca conta corrente PDS como company + owner_current", () => {
    const p = state.parties.find((x) => x.id === "emanuel-cw");
    expect(p?.ownership).toBe("company");
    expect(p?.role).toBe("owner_current");
  });

  it("custodyLiquidity = Lenu + Eduardo", () => {
    expect(custodyLiquidity(state)).toBe(437600 + 43316);
  });

  it("personalOwnLiquidity = bruto − custody (nunca inclui Lenu/Eduardo)", () => {
    const bruto = personalGrossLiquidity(state);
    const custody = custodyLiquidity(state);
    expect(personalOwnLiquidity(state)).toBeCloseTo(bruto - custody, 2);
    expect(personalOwnLiquidity(state)).toBeCloseTo(701794.08, 2);
  });

  it("allocatablePersonal nunca inclui custody", () => {
    const a = allocatablePersonal(state);
    expect(a).toBe(personalOwnLiquidity(state) - allocatedPersonal(state));
    expect(a).toBeLessThan(personalGrossLiquidity(state));
    expect(a + custodyLiquidity(state)).toBeCloseTo(personalGrossLiquidity(state), 2);
  });

  it("unallocated é alias seguro de allocatablePersonal (exclui custody)", () => {
    expect(unallocated(state)).toBe(allocatablePersonal(state));
    expect(unallocated(state)).not.toBe(personalGrossLiquidity(state));
  });

  it("spendablePersonal = operacional + lazer (só bolsos; seed sem alocação = 0)", () => {
    expect(spendablePersonal(state)).toBe(0);
  });

  it("custody nunca entra em spendable mesmo com alocação indevida no stock", () => {
    // spendable só lê envelopes; custody não aumenta envelopes
    const after = withMoves(state, [
      {
        id: "t-alloc",
        at: "2026-08-20",
        kind: "alocacao",
        amount: 10000,
        from: { type: "unallocated" },
        to: { type: "envelope", id: "lazer" },
        entityId: "pessoal",
        envelopeId: "lazer",
      },
    ]);
    expect(spendablePersonal(after)).toBe(10000);
    expect(custodyLiquidity(after)).toBe(custodyLiquidity(state));
    expect(allocatablePersonal(after)).toBe(allocatablePersonal(state) - 10000);
  });

  it("companyLiquidity = PDS + Plural + Picasso's + PH", () => {
    expect(liquidityByEntity(state, "cw")).toBeCloseTo(69560, 2);
    expect(liquidityByEntity(state, "rove")).toBeCloseTo(72508.78, 2);
    expect(liquidityByEntity(state, "picasso")).toBe(21500);
    expect(liquidityByEntity(state, "ph")).toBe(36500);
    expect(companyLiquidity(state)).toBeCloseTo(69560 + 72508.78 + 21500 + 36500, 2);
  });

  it("company nunca entra em allocatablePersonal", () => {
    const before = allocatablePersonal(state);
    // mais caixa empresa não muda allocatable pessoal
    const richer = {
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === "cw-caixa" ? { ...a, opening: a.opening + 1_000_000 } : a,
      ),
    };
    expect(allocatablePersonal(richer)).toBe(before);
    expect(companyLiquidity(richer)).toBe(companyLiquidity(state) + 1_000_000);
  });

  it("STAND está na liquidez pessoal bruta (conta própria, não empresa)", () => {
    expect(state.accounts.find((a) => a.id === "stand")?.entityId).toBe("pessoal");
    expect(personalGrossLiquidity(state)).toBeGreaterThanOrEqual(1_000_000);
  });
});
