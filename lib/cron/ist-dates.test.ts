import { describe, expect, it } from "vitest";

import {
  addIstCalendarDays,
  daysInMonth,
  istDateStringToParts,
  signalMonthFirstDayYmd,
  toIstYmd,
} from "./ist-dates";

describe("toIstYmd", () => {
  it("formats calendar date in Asia/Kolkata", () => {
    const d = new Date("2026-04-01T10:30:00+05:30");
    expect(toIstYmd(d)).toBe("2026-04-01");
  });
});

describe("addIstCalendarDays", () => {
  it("adds one day within the same month", () => {
    expect(addIstCalendarDays("2026-04-01", 1)).toBe("2026-04-02");
  });

  it("crosses month boundary", () => {
    expect(addIstCalendarDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("handles leap year February", () => {
    expect(addIstCalendarDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addIstCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addIstCalendarDays("2024-02-29", 1)).toBe("2024-03-01");
  });
});

describe("daysInMonth", () => {
  it("returns correct length for short and long months", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });
});

describe("istDateStringToParts", () => {
  it("parses Y-M-D", () => {
    expect(istDateStringToParts("2026-08-15")).toEqual({
      year: 2026,
      month: 8,
      day: 15,
    });
  });
});

describe("signalMonthFirstDayYmd", () => {
  it("is the first day of the month containing the given IST date", () => {
    expect(signalMonthFirstDayYmd("2026-04-15")).toBe("2026-04-01");
    expect(signalMonthFirstDayYmd("2026-01-31")).toBe("2026-01-01");
  });
});
