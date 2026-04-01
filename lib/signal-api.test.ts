import { describe, expect, it } from "vitest";

import { buildSignalSuccessPayload } from "./signal-api";
import type { MarketDataRow } from "./market-snapshot";

const calmMarket: MarketDataRow = {
  date: "2026-04-01",
  nifty_close: 20_000,
  nifty_pe: 22,
  india_vix: 15,
  ma_200: 19_500,
  pe_5yr_avg: 22,
};

describe("buildSignalSuccessPayload", () => {
  it("matches engine output shape and asOf date", () => {
    const payload = buildSignalSuccessPayload(calmMarket);
    expect(payload.ok).toBe(true);
    expect(payload.asOf).toBe("2026-04-01");
    expect(payload.multiplier).toBe(1);
    expect(payload.geoOverride).toBe(false);
    expect(payload.breakdown.length).toBeGreaterThan(0);
    for (const item of payload.breakdown) {
      expect(item).toMatchObject({
        signal: expect.any(String),
        condition: expect.any(String),
        contribution: expect.any(Number),
        status: expect.stringMatching(/^(active|inactive|warning)$/),
      });
    }
  });

  it("agrees with a known expensive-market scenario", () => {
    const expensive: MarketDataRow = {
      ...calmMarket,
      nifty_pe: 31,
      pe_5yr_avg: 25,
    };
    const payload = buildSignalSuccessPayload(expensive);
    expect(payload.multiplier).toBe(0.5);
    expect(payload.peSignal).toBe(-0.5);
  });
});
