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
    expect(parseAmountKz("Tirei 10 mil do Lenu")).toBe(10_000);
    expect(parseAmountKz("Recebi 2 milhões")).toBe(2_000_000);
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

  it("Usei 2000 da PDS → empréstimo (não despesa)", () => {
    const p = parseReportLine("Usei 2000 da PDS", seedState());
    expect(p.action.type).toBe("movement");
    if (p.action.type !== "movement") return;
    expect(p.action.draft.kind).toBe("emprestimo_proprietario");
    expect(p.action.draft.amount).toBe(2000);
    expect(p.action.draft.entityId).toBe("cw");
  });

  it("Recebi 5000 do Ferraz → cobrança", () => {
    const p = parseReportLine("Recebi 5000 do Ferraz", seedState());
    expect(p.action.type).toBe("collectParty");
    if (p.action.type !== "collectParty") return;
    expect(p.action.partyId).toBe("ferraz");
    expect(p.action.amount).toBe(5000);
  });

  it("Tirei 10 mil do Lenu → custódia 10000", () => {
    const p = parseReportLine("Tirei 10 mil do Lenu", seedState());
    expect(p.action.type).toBe("payParty");
    if (p.action.type !== "payParty") return;
    expect(p.action.partyId).toBe("lenu");
    expect(p.action.amount).toBe(10_000);
  });

  it("Emprestei 5000 ao Nuno → sem padrão forte (não inventa)", () => {
    const p = parseReportLine("Emprestei 5000 ao Nuno", seedState());
    expect(p.action.type).toBe("unknown");
  });

  it("Transferi entre bancos → não inventa transferência", () => {
    const p = parseReportLine("Transferi 10000 do BAI pro STAND", seedState());
    expect(p.action.type).toBe("unknown");
  });

  it("frase ambígua pode pedir clarificação", () => {
    const turn = interpretChat("Paguei 5000 na PDS", seedState(), seedState().asOf, null);
    // despesa empresa é o caminho esperado; se empatar, clarify
    expect(["fresh", "clarify"]).toContain(turn.type);
    if (turn.type === "fresh") {
      expect(turn.proposal.action.type).toBe("movement");
      if (turn.proposal.action.type === "movement") {
        expect(turn.proposal.action.draft.kind).toBe("despesa");
      }
    }
    if (turn.type === "clarify") {
      expect(turn.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("quanto tenho no BAI → info com saldo", () => {
    const s = seedState();
    const turn = interpretChat("quanto tenho no BAI", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/BAI/i);
    expect(turn.text).toMatch(/Kz/);
  });

  it("saldo na caixa → info", () => {
    const s = seedState();
    const turn = interpretChat("saldo na caixa", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Kz/);
  });

  it("quanto devo ao Tuni → info party", () => {
    const s = seedState();
    const turn = interpretChat("quanto devo ao Tuni", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Tuni/i);
    expect(turn.text).toMatch(/60/);
  });

  it("quanto tem cada empresa → info das quatro caixas", () => {
    const s = seedState();
    const turn = interpretChat("quanto tem cada empresa", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/PDS/i);
    expect(turn.text).toMatch(/Plural/i);
    expect(turn.text).toMatch(/Picasso/i);
    expect(turn.text).toMatch(/\bPH\b/);
  });

  it("e a Picasso's → info da empresa", () => {
    const s = seedState();
    const turn = interpretChat("e a Picasso's", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Picasso/i);
    expect(turn.text).toMatch(/Kz/);
  });

  it("empresa no texto não confunde com conta PH", () => {
    expect(detectAccount(seedState(), "quanto tem cada empresa")).toBeNull();
  });

  it("minhas dívidas → lista a pagar (próprias + custódia)", () => {
    const s = seedState();
    const turn = interpretChat("minhas dívidas?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Tuni/i);
    expect(turn.text).toMatch(/Dívidas próprias/i);
    expect(turn.text).not.toMatch(/Caixa de cada empresa/);
  });

  it("Minhas d → trata como dívidas", () => {
    const s = seedState();
    const turn = interpretChat("Minhas d", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Dívidas próprias|Tuni/i);
  });

  it("a receber → lista créditos", () => {
    const s = seedState();
    const turn = interpretChat("a receber", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Ferraz|A receber/i);
  });

  it("o que é custódia → definição do glossário", () => {
    const s = seedState();
    const turn = interpretChat("O QUE É CUSTODIA?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/cust[oó]dia/i);
    expect(turn.text).toMatch(/terceiros|não é dívida/i);
    expect(turn.text).not.toMatch(/Caixa de cada empresa/);
  });

  it("o que é alocável → definição", () => {
    const s = seedState();
    const turn = interpretChat("o que é alocável?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/[Aa]locável/);
    expect(turn.text).toMatch(/bolso/i);
  });

  it("como calcular um pró-labore → guia do Caderno", () => {
    const s = seedState();
    const turn = interpretChat("COMO CALCULAR UM PRÓ-LABORE?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/[Pp]ró-labore|pro-labore/i);
    expect(turn.text).toMatch(/Meter|Remuneração|empresa/i);
    expect(turn.text).not.toMatch(/Sem valor/);
  });

  it("como fazer e calcular lucro → guia de lucro (não pró-labore)", () => {
    const s = seedState();
    const turn = interpretChat("COMO FAZER E CALCULAR LUCRO?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/[Ll]ucro/);
    expect(turn.text).not.toMatch(/Como calcular um pró-labore/);
    expect(turn.text).toMatch(/\n/);
  });
});
