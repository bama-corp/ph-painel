import { describe, expect, it } from "vitest";
import { answerMetricQuestion, isMetricQuery } from "./assistMetrics";
import { interpretChat } from "./dailyReport";
import { companyMonthOutlook, roveMrr } from "./engine";
import { seedState } from "./seed";

describe("assistMetrics — KPIs ao vivo", () => {
  it("detecta perguntas de métrica sem montante", () => {
    expect(isMetricQuery("lucro esperado Plural")).toBe(true);
    expect(isMetricQuery("Porque lucro esperado negativo?")).toBe(true);
    expect(isMetricQuery("MRR")).toBe(true);
    expect(isMetricQuery("caixa actual PDS")).toBe(true);
    expect(isMetricQuery("como calcular lucro")).toBe(false);
    expect(isMetricQuery("paguei 5000 na PDS")).toBe(false);
    expect(isMetricQuery("e a Picasso's")).toBe(false);
  });

  it("lucro esperado Plural: receita 0 − planeados 37k = -37k", () => {
    const s = seedState();
    const o = companyMonthOutlook(s, "rove");
    expect(o.receita).toBe(0);
    expect(o.planned).toBe(37_000);
    expect(o.lucroEsperado).toBe(-37_000);

    const text = answerMetricQuestion("lucro esperado Plural", s);
    expect(text).toBeTruthy();
    expect(text).toMatch(/Lucro esperado \(Plural\)/);
    expect(text).toMatch(/-37\s*000/);
    expect(text).toMatch(/37\s*000/);
    expect(text).toMatch(/receita − max/i);
    expect(text).toMatch(/não há receita|Ainda não há receita/i);
  });

  it("porque negativo → explica causa com números live", () => {
    const s = seedState();
    const text = answerMetricQuestion("Porque o lucro esperado está negativo?", s);
    expect(text).toBeTruthy();
    expect(text).toMatch(/-37\s*000/);
    expect(text).toMatch(/recorrentes|planeados/i);
  });

  it("MRR vs receita declarada", () => {
    const s = seedState();
    const mrr = roveMrr(s);
    const text = answerMetricQuestion("MRR Plural", s);
    expect(text).toBeTruthy();
    expect(text).toMatch(/MRR \(Plural\)/);
    expect(text).toMatch(new RegExp(mrr.toLocaleString("pt-PT")));
    expect(text).toMatch(/declarada/i);
    expect(Math.abs(mrr - s.declared.roveRevenue)).toBeGreaterThan(1000);
    expect(text).toMatch(/Diferença|alerta/i);
  });

  it("interpretChat: lucro esperado antes de saldo da empresa", () => {
    const s = seedState();
    const turn = interpretChat("lucro esperado Plural", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Lucro esperado/);
    expect(turn.text).not.toMatch(/^Plural: .* no total/);
  });

  it("interpretChat: como calcular lucro continua no Caderno", () => {
    const s = seedState();
    const turn = interpretChat("como calcular lucro", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/Lucro registado|dois lucros|Atalho/i);
    expect(turn.text).not.toMatch(/Fórmula: receita − max/);
  });

  it("lucro esperado PDS usa planeados da PDS (35k)", () => {
    const s = seedState();
    const o = companyMonthOutlook(s, "cw");
    expect(o.planned).toBe(35_000);
    const text = answerMetricQuestion("lucro esperado PDS", s);
    expect(text).toMatch(/PDS/);
    expect(text).toMatch(/35\s*000/);
  });
});
