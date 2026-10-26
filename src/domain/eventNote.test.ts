import { describe, expect, it } from "vitest";
import { composeEventNote, isEventTask, parseEventNote } from "./tasks";

describe("notas de evento", () => {
  it("guarda hora e local e volta a lê-los", () => {
    const note = composeEventNote("18:30", "Cyber PDS", "Torneio de sexta");
    expect(parseEventNote(note)).toEqual({
      time: "18:30",
      place: "Cyber PDS",
      note: "Torneio de sexta",
    });
  });

  it("reconhece o conjunto de eventos", () => {
    expect(isEventTask({ bundle: "eventos" })).toBe(true);
    expect(isEventTask({ bundle: "js-novembro-2026" })).toBe(false);
  });
});