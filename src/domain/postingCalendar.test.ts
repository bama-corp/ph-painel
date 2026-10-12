import { describe, expect, it } from "vitest";
import {
  WEEKLY_POST_PLAN,
  addDaysYmd,
  mondayOfWeek,
  planForWeekday,
  weekDatesFromMonday,
} from "./postingCalendar";

describe("postingCalendar", () => {
  it("tem plano para os 7 dias", () => {
    expect(WEEKLY_POST_PLAN).toHaveLength(7);
    for (let d = 0; d < 7; d++) {
      expect(planForWeekday(d as 0 | 1 | 2 | 3 | 4 | 5 | 6).weekday).toBe(d);
    }
  });

  it("mondayOfWeek alinha à segunda", () => {
    // 2026-10-14 = quarta → segunda 2026-10-12
    expect(mondayOfWeek("2026-10-14")).toBe("2026-10-12");
    expect(mondayOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(mondayOfWeek("2026-10-18")).toBe("2026-10-12");
  });

  it("weekDatesFromMonday cobre Seg–Dom", () => {
    const days = weekDatesFromMonday("2026-10-12");
    expect(days.map((d) => d.ymd)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(addDaysYmd("2026-10-12", 7)).toBe("2026-10-19");
  });
});
