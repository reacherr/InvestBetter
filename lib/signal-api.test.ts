import { describe, expect, it } from "vitest";

import { buildSignalSuccessPayload } from "./signal-api";

describe("buildSignalSuccessPayload", () => {
  it("returns engine output with asOf date", () => {
    const payload = buildSignalSuccessPayload({
      date: "2026-04-01",
      nifty_close: 20_000,
      nifty_pe: 22,
      india_vix: 15,
      ma_200: 19_500,
      pe_5yr_avg: 22,
    });
    expect(payload.ok).toBe(true);
    expect(payload.asOf).toBe("2026-04-01");
    expect(typeof payload.multiplier).toBe("number");
    expect(Array.isArray(payload.breakdown)).toBe(true);
  });
});
