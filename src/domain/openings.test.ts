import { describe, expect, it } from "vitest";
import {
  applyAccountOpening,
  applyPartyOpening,
  canEditAccountOpening,
  liquidityOf,
  partyOf,
  postLiquidityAdjustment,
} from "./engine";
import { seedState } from "./seed";
import type { Movement } from "./types";

const receitaBai: Movement = {
  id: "m-rec-bai",
  at: "2026-08-20",
  kind: "receita",
  amount: 5000,
  from: { type: "world" },
  to: { type: "liquidity", id: "bai" },
  entityId: "pessoal",
  note: "Entrada teste",
};

describe("Passo 2 — openings e ajustes", () => {
  it("seed: openings editáveis quando teu ≥ custódia na conta", () => {
    const s = seedState();
    expect(canEditAccountOpening(s, "bai")).toBe(true);
    expect(canEditAccountOpening(s, "cw-caixa")).toBe(true);
    // ATLANTICO tem custódia Lenu/Eduardo > teu → bloqueado
    expect(canEditAccountOpening(s, "atlantico")).toBe(false);
  });

  it("opening pode ser alterado quando teu ≥ custódia", () => {
    const s = seedState();
    const r = applyAccountOpening(s, "bai", 200_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.accounts.find((a) => a.id === "bai")?.opening).toBe(200_000);
    expect(liquidityOf(r.state, "bai")).toBe(200_000);
  });

  it("opening continua editável após movimentos se teu ≥ custódia", () => {
    const s = { ...seedState(), movements: [receitaBai, ...seedState().movements] };
    const before = s.accounts.find((a) => a.id === "bai")!.opening;
    const live = liquidityOf(s, "bai");
    expect(live).toBe(before + 5000);

    const r = applyAccountOpening(s, "bai", 999);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.accounts.find((a) => a.id === "bai")?.opening).toBe(999);
    expect(liquidityOf(r.state, "bai")).toBe(999 + 5000);
  });

  it("opening bloqueado quando teu < custódia na conta", () => {
    const s = seedState();
    const before = s.accounts.find((a) => a.id === "atlantico")!.opening;
    const r = applyAccountOpening(s, "atlantico", 1);
    expect(r.ok).toBe(false);
    expect(r.state.accounts.find((a) => a.id === "atlantico")?.opening).toBe(before);
  });

  it("ajuste auditado corrige saldo sem mudar opening", () => {
    const s = { ...seedState(), movements: [receitaBai, ...seedState().movements] };
    const opening = s.accounts.find((a) => a.id === "bai")!.opening;
    const r = postLiquidityAdjustment(s, "bai", opening + 1000, {
      id: "ajuste-1",
      note: "Correcção de extracto",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.accounts.find((a) => a.id === "bai")?.opening).toBe(opening);
    expect(liquidityOf(r.state, "bai")).toBe(opening + 1000);
    expect(r.state.movements[0]?.kind).toBe("ajuste");
    expect(r.state.movements[0]?.note).toContain("Correcção");
  });

  it("party opening bloqueado após movimento na party", () => {
    const s = seedState();
    const payTuni: Movement = {
      id: "m-tuni",
      at: "2026-08-21",
      kind: "despesa",
      amount: 10000,
      from: { type: "liquidity", id: "bai" },
      to: { type: "party", id: "tuni-pag" },
      entityId: "pessoal",
      note: "Pagamento parcial Tuni",
    };
    // Nota: este movimento ainda não é o modelo final de pagamento party (passo 5);
    // só valida o bloqueio de opening após toque no ledger da party.
    const withMove = { ...s, movements: [payTuni, ...s.movements] };
    const before = partyOf(withMove, "tuni-pag");
    const r = applyPartyOpening(withMove, "tuni-pag", 1);
    expect(r.ok).toBe(false);
    expect(partyOf(r.state, "tuni-pag")).toBe(before);
  });

  it("Lenu custody: opening editável no seed (sem movimentos); números preservados", () => {
    const s = seedState();
    expect(s.parties.find((p) => p.id === "lenu")?.opening).toBe(437600);
    const r = applyPartyOpening(s, "lenu", 437600);
    expect(r.ok).toBe(true);
  });
});
