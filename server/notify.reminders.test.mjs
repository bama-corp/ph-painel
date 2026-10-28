import { describe, expect, it } from "vitest";
import { routineReminders } from "./notify.mjs";

describe("routineReminders", () => {
  const now = new Date("2026-10-27T07:00:00Z");

  it("agenda a hora de amanhã em Luanda, uma vez", () => {
    const msgs = routineReminders(
      [
        { title: "Leitura", weekday: 2, active: true, startsAt: "07:30", dayBlock: "manha", timeboxMin: 25 },
        { title: "Sem hora", weekday: 2, active: true, startsAt: "" },
        { title: "Pausada", weekday: 2, active: false, startsAt: "08:00" },
        { title: "Hoje", weekday: 1, active: true, startsAt: "10:00" },
      ],
      { now, offsetMin: 60 },
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].title).toBe("Rotina · 07:30");
    expect(msgs[0].at).toBe("2026-10-28T06:30:00Z");
    expect(msgs[0].text).toContain("Leitura");
    expect(msgs[0].text).toContain("Quarta");
    expect(msgs[0].priority).toBe("high");
  });
});
