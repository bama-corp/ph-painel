import { describe, expect, it } from "vitest";
import {
  detectAccount,
  interpretChat,
  parseAmountKz,
  parseReportLine,
  reviseProposal,
} from "./dailyReport";
import { seedState } from "./seed";

describe("Assistente — relatório do dia", () => {
  it("parseAmountKz lê formatos PT", () => {
    expect(parseAmountKz("Emprestei 2000kz na PDS")).toBe(2000);
    expect(parseAmountKz("Recebi 2.000,50 Kz")).toBe(2000.5);
    expect(parseAmountKz("Paguei 10 000")).toBe(10_000);
  });

  it("Emprestei 2000kz na PDS → emprestimo_proprietario", () => {
    const p = parseReportLine("Emprestei 2000kz na PDS", seedState());
    expect(p.action.type).toBe("movement");
    if (p.action.type !== "movement") return;
    expect(p.action.draft.kind).toBe("emprestimo_proprietario");
    expect(p.action.draft.amount).toBe(2000);
    expect(p.action.draft.entityId).toBe("cw");
    expect(p.action.draft.otherEntityId).toBe("pessoal");
    expect(p.confidence).toBe("high");
  });

  it("Recebi na PDS → receita cw", () => {
    const p = parseReportLine("Recebi 8500 na PDS", seedState());
    expect(p.action.type).toBe("movement");
    if (p.action.type !== "movement") return;
    expect(p.action.draft.kind).toBe("receita");
    expect(p.action.draft.entityId).toBe("cw");
  });

  it("Paguei Tuni → payParty", () => {
    const p = parseReportLine("Paguei Tuni 5000", seedState());
    expect(p.action.type).toBe("payParty");
    if (p.action.type !== "payParty") return;
    expect(p.action.partyId).toBe("tuni-pag");
    expect(p.action.amount).toBe(5000);
  });

  it("Emprestei custódia do Lenu → payParty (liberta custódia)", () => {
    const p = parseReportLine(
      "Emprestei os 30000kz do Lenu que estavam em custodia",
      seedState(),
    );
    expect(p.action.type).toBe("payParty");
    if (p.action.type !== "payParty") return;
    expect(p.action.partyId).toBe("lenu");
    expect(p.action.amount).toBe(30_000);
    expect(p.confidence).toBe("high");
  });

  it("Custódia de alguém inexistente → explica criar party", () => {
    const p = parseReportLine(
      "Emprestei os 30000kz do Eliandro que estavam em custodia",
      seedState(),
    );
    expect(p.action.type).toBe("unknown");
    expect(p.summary).toMatch(/Eliandro/i);
    expect(p.detail).toMatch(/Contas/i);
  });

  it("detectAccount reconhece caixa pessoal", () => {
    expect(detectAccount(seedState(), "O valor estava em caixa pessoal")).toBe("caixa-p");
    expect(detectAccount(seedState(), "na caixa")).toBe("caixa-p");
    expect(detectAccount(seedState(), "no BAI")).toBe("bai");
  });

  it("correcção «caixa pessoal» actualiza proposta pendente", () => {
    const s = seedState();
    const pending = parseReportLine(
      "Emprestei os 30000kz do Lenu que estavam em custodia",
      s,
    );
    expect(pending.action.type).toBe("payParty");
    if (pending.action.type !== "payParty") return;

    const turn = interpretChat("O valor estava em caixa pessoal", s, s.asOf, pending);
    expect(turn.type).toBe("revise");
    if (turn.type !== "revise") return;
    expect(turn.proposal.action.type).toBe("payParty");
    if (turn.proposal.action.type !== "payParty") return;
    expect(turn.proposal.action.accountId).toBe("caixa-p");
    expect(turn.proposal.action.amount).toBe(30_000);
    expect(turn.proposal.detail).toMatch(/Caixa/i);
  });

  it("sim / não sobre pendente", () => {
    const s = seedState();
    const pending = parseReportLine("Paguei Tuni 5000", s);
    expect(interpretChat("sim", s, s.asOf, pending).type).toBe("confirm");
    expect(interpretChat("não", s, s.asOf, pending).type).toBe("skip");
  });

  it("reviseProposal muda valor", () => {
    const s = seedState();
    const pending = parseReportLine("Paguei Tuni 5000", s);
    const r = reviseProposal(pending, "foi 8000", s);
    expect(r).not.toBeNull();
    if (!r || r.proposal.action.type !== "payParty") return;
    expect(r.proposal.action.amount).toBe(8000);
  });
});
