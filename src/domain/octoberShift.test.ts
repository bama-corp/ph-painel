import { describe, expect, it } from "vitest";
import { novemberDue, rewriteOctoberCopy, shiftOctoberTechTask } from "./octoberShift";
import type { Task } from "./tasks";

describe("novemberDue", () => {
  it("avança o dia um mês e encosta o dia 31 a 30 de Novembro", () => {
    expect(novemberDue("2026-10-01")).toBe("2026-11-01");
    expect(novemberDue("2026-10-26")).toBe("2026-11-26");
    expect(novemberDue("2026-10-30")).toBe("2026-11-30");
    expect(novemberDue("2026-10-31")).toBe("2026-11-30");
    expect(novemberDue("2026-11-02")).toBe("2026-11-02");
  });
});

describe("rewriteOctoberCopy", () => {
  it("reescreve o mês nos títulos e nas notas que olham para o mês seguinte", () => {
    expect(rewriteOctoberCopy("26 OUT — API → interface", "2026-11-26")).toBe(
      "26 NOV — API → interface",
    );
    expect(rewriteOctoberCopy("31 OUT — Auditoria do mês (sem conteúdo novo)", "2026-11-30")).toBe(
      "30 NOV — Auditoria do mês (sem conteúdo novo)",
    );
    expect(rewriteOctoberCopy("OUT 2026 — Meta: app JS + API no GitHub", "2026-11-30")).toBe(
      "NOV 2026 — Meta: app JS + API no GitHub",
    );
    expect(rewriteOctoberCopy("Marco final — Projecto Outubro publicado", "2026-11-30")).toBe(
      "Marco final — Projecto Novembro publicado",
    );
    expect(rewriteOctoberCopy("Projeto 2030 · Outubro JS · 2h", "2026-11-01")).toBe(
      "Projeto 2030 · Novembro JS · 2h",
    );
    expect(rewriteOctoberCopy("Problema real para Novembro?", "2026-11-30")).toBe(
      "Problema real para Dezembro?",
    );
    expect(rewriteOctoberCopy("consigo sozinho / Novembro", "2026-11-30")).toBe(
      "consigo sozinho / Dezembro",
    );
  });
});

describe("shiftOctoberTechTask", () => {
  const base = {
    id: "seed-js-2026-2026-10-31",
    title: "31 OUT — Auditoria do mês",
    note: "Outubro JS",
    due: "2026-10-31",
    bundle: "js-outubro-2026",
    area: "tecnologia",
    subtasks: [{ id: "s1", title: "Problema real para Novembro?", done: true }],
    status: "para_fazer" as const,
    updatedAt: "2026-10-01T00:00:00.000Z",
  };

  it("move a data, o texto e o conjunto sem perder o progresso", () => {
    const shifted = shiftOctoberTechTask(base);
    expect(shifted.due).toBe("2026-11-30");
    expect(shifted.title).toBe("30 NOV — Auditoria do mês");
    expect(shifted.note).toBe("Novembro JS");
    expect(shifted.bundle).toBe("js-novembro-2026");
    expect(shifted.subtasks[0]).toEqual({
      id: "s1",
      title: "Problema real para Dezembro?",
      done: true,
    });
    expect(shifted.status).toBe("para_fazer");
    expect(shifted.updatedAt).not.toBe(base.updatedAt);
  });

  it("ignora tarefas que não são o plano de Tecnologia", () => {
    const other: Task = {
      id: "t1",
      entityId: "pessoal",
      title: "1 OUT — outra coisa",
      note: "",
      status: "para_fazer",
      quadrant: "",
      focusToday: false,
      at: "2026-10-01",
      due: "2026-10-01",
      timeboxMin: 0,
      dayBlock: "",
      routineId: "",
      bundle: "",
      area: "tecnologia",
      subtasks: [],
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    expect(shiftOctoberTechTask(other)).toBe(other);
  });

  it("é idempotente depois da primeira passagem", () => {
    const once = shiftOctoberTechTask(base);
    expect(shiftOctoberTechTask(once)).toBe(once);
  });
});
