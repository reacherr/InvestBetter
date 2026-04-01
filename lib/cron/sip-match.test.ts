import { describe, expect, it } from "vitest";

import { sipDayMatchesTomorrow } from "./sip-match";

describe("sipDayMatchesTomorrow", () => {
  it("matches exact day-of-month", () => {
    expect(sipDayMatchesTomorrow(15, "2026-08-15")).toBe(true);
    expect(sipDayMatchesTomorrow(14, "2026-08-15")).toBe(false);
  });

  it("includes overflow 29–31 when tomorrow is the last day of a short month", () => {
    expect(sipDayMatchesTomorrow(29, "2026-02-28")).toBe(true);
    expect(sipDayMatchesTomorrow(30, "2026-02-28")).toBe(true);
    expect(sipDayMatchesTomorrow(31, "2026-02-28")).toBe(true);
    expect(sipDayMatchesTomorrow(28, "2026-02-28")).toBe(true);
    expect(sipDayMatchesTomorrow(27, "2026-02-28")).toBe(false);
  });

  it("handles leap February last day", () => {
    expect(sipDayMatchesTomorrow(30, "2024-02-29")).toBe(true);
    expect(sipDayMatchesTomorrow(31, "2024-02-29")).toBe(true);
    expect(sipDayMatchesTomorrow(29, "2024-02-29")).toBe(true);
    expect(sipDayMatchesTomorrow(28, "2024-02-29")).toBe(false);
  });

  it("does not apply overflow when tomorrow is not month end", () => {
    expect(sipDayMatchesTomorrow(31, "2026-03-15")).toBe(false);
    expect(sipDayMatchesTomorrow(15, "2026-03-15")).toBe(true);
  });
});
