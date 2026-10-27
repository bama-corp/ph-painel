import { describe, expect, it } from "vitest";
import { blockFromTime, normalizeStartsAt, placeRoutine, type Routine, type Weekday } from "./routines";
import type { TaskDayBlock } from "./tasks";

function routine(partial: {
  id: string;
  title: string;
  weekday: Weekday;
  dayBlock?: TaskDayBlock;
  sortOrder?: number;
}): Routine {
  return {
    id: partial.id,
    entityId: "pessoal",
    title: partial.title,
    note: "",
    weekday: partial.weekday,
    timeboxMin: 0,
    startsAt: "",
    dayBlock: partial.dayBlock ?? "manha",
    focusToday: false,
    active: true,
    sortOrder: partial.sortOrder ?? 0,
    lastSpawnYmd: "",
    area: "tecnologia",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("placeRoutine", () => {
  const list = [
    routine({ id: "a", title: "A", weekday: 0, sortOrder: 0 }),
    routine({ id: "b", title: "B", weekday: 0, sortOrder: 1 }),
    routine({ id: "c", title: "C", weekday: 0, sortOrder: 2 }),
  ];

  it("desce uma posição dentro do mesmo bloco", () => {
    const next = placeRoutine(list, "a", { weekday: 0, dayBlock: "manha", index: 1 });
    expect(next).not.toBeNull();
    const order = next!
      .filter((r) => r.weekday === 0 && r.dayBlock === "manha")
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((r) => r.id);
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("muda de dia e de bloco", () => {
    const next = placeRoutine(list, "b", { weekday: 2, dayBlock: "noite", index: 0 });
    const moved = next!.find((r) => r.id === "b");
    expect(moved?.weekday).toBe(2);
    expect(moved?.dayBlock).toBe("noite");
    expect(moved?.sortOrder).toBe(0);
  });

  it("não escreve se o destino é o mesmo", () => {
    expect(placeRoutine(list, "a", { weekday: 0, dayBlock: "manha", index: 0 })).toBe(list);
  });
});

describe("hora da rotina", () => {
  it("normaliza HH:mm e rejeita horas inválidas", () => {
    expect(normalizeStartsAt("8:05")).toBe("08:05");
    expect(normalizeStartsAt("18:30")).toBe("18:30");
    expect(normalizeStartsAt("24:00")).toBe("");
    expect(normalizeStartsAt("")).toBe("");
  });

  it("escolhe o bloco a partir da hora", () => {
    expect(blockFromTime("07:30")).toBe("manha");
    expect(blockFromTime("12:00")).toBe("tarde");
    expect(blockFromTime("18:00")).toBe("noite");
    expect(blockFromTime("")).toBe("");
  });
});
