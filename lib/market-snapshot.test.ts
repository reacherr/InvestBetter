import { describe, expect, it } from "vitest";

import { marketRowToSnapshot } from "./market-snapshot";

describe("marketRowToSnapshot", () => {
  it("maps DB row fields; null PE avg falls back to nifty PE", () => {
    const snap = marketRowToSnapshot({
      date: "2026-04-01",
      nifty_close: 20_000,
      nifty_pe: 22,
      india_vix: 15,
      ma_200: null,
      pe_5yr_avg: null,
    });
    expect(snap.pe5yrAvg).toBe(22);
    expect(snap.ma200).toBe(20_000);
    expect(snap.monthsBelow200DMA).toBe(0);
    expect(snap.drawdownFrom52wHigh).toBe(0);
  });
});
