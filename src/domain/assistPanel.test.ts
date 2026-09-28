import { describe, expect, it } from "vitest";
import { answerPanelQuestion, isInfoSeekingQuery } from "./assistPanel";
import { interpretChat } from "./dailyReport";
import { seedState } from "./seed";

describe("assistPanel — qualquer zona do painel", () => {
  it("detecta pedidos de informação", () => {
    expect(isInfoSeekingQuery("resumo")).toBe(true);
    expect(isInfoSeekingQuery("alertas")).toBe(true);
    expect(isInfoSeekingQuery("quanto posso gastar?")).toBe(true);
    expect(isInfoSeekingQuery("paguei 5000 na PDS")).toBe(false);
  });

  it("resumo devolve liquidez e empresas", () => {
    const s = seedState();
    const text = answerPanelQuestion("resumo", s);
    expect(text).toMatch(/Resumo do painel/);
    expect(text).toMatch(/Liquidez própria/);
    expect(text).toMatch(/Plural/);
  });

  it("bolsos lista envelopes", () => {
    const s = seedState();
    const text = answerPanelQuestion("mostra os bolsos", s);
    expect(text).toMatch(/Bolsos/);
    expect(text).toMatch(/Operacional/);
    expect(text).toMatch(/Lazer/);
  });

  it("alertas lista avisos live", () => {
    const s = seedState();
    const text = answerPanelQuestion("quais são os alertas?", s);
    expect(text).toMatch(/Alertas/);
  });

  it("clientes Plural inclui MRR", () => {
    const s = seedState();
    const text = answerPanelQuestion("clientes Plural", s);
    expect(text).toMatch(/Clientes Plural/);
    expect(text).toMatch(/MRR/);
  });

  it("interpretChat: resumo não cai em Sem valor", () => {
    const s = seedState();
    const turn = interpretChat("como estou?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).not.toMatch(/Sem valor/);
    expect(turn.text).toMatch(/Liquidez|Resumo|Gastável/i);
  });

  it("interpretChat: mapa ajuda", () => {
    const s = seedState();
    const turn = interpretChat("o que posso perguntar?", s, s.asOf, null);
    expect(turn.type).toBe("info");
    if (turn.type !== "info") return;
    expect(turn.text).toMatch(/O que podes perguntar|mapa|bolsos/i);
  });
});
