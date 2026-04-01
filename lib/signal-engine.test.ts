import { describe, expect, it } from "vitest";

import { calculateMultiplier, type MarketSnapshot } from "./signal-engine";

function baseMarket(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    niftyPE: 22,
    pe5yrAvg: 22,
    niftyClose: 20_000,
    ma200: 19_500,
    vix: 15,
    monthsBelow200DMA: 0,
    drawdownFrom52wHigh: 0,
    ...overrides,
  };
}

describe("calculateMultiplier", () => {
  it("flags expensive market as warning and applies -0.5 contribution", () => {
    const res = calculateMultiplier(baseMarket({ niftyPE: 31, pe5yrAvg: 25 }));
    expect(res.peSignal).toBe(-0.5);
    expect(res.multiplier).toBe(0.5);

    const item = res.breakdown.find((b) => b.signal === "Valuation");
    expect(item?.status).toBe("warning");
    expect(item?.contribution).toBe(-0.5);
  });

  it("activates cheap market and applies +1.0 contribution", () => {
    const res = calculateMultiplier(baseMarket({ niftyPE: 17.5, pe5yrAvg: 22 }));
    expect(res.peSignal).toBe(1.0);
    expect(res.multiplier).toBe(2.0);

    const item = res.breakdown.find((b) => b.signal === "Valuation");
    expect(item?.status).toBe("active");
    expect(item?.contribution).toBe(1.0);
  });

  it("activates below-200DMA trend and applies +1.0 contribution", () => {
    const res = calculateMultiplier(
      baseMarket({ niftyClose: 18_000, ma200: 19_500 }),
    );
    expect(res.trendSignal).toBe(1.0);
    expect(res.multiplier).toBe(2.0);

    const item = res.breakdown.find((b) => b.signal === "Trend");
    expect(item?.status).toBe("active");
    expect(item?.contribution).toBe(1.0);
  });

  it("activates VIX elevated and extreme states with expected contributions", () => {
    const elevated = calculateMultiplier(baseMarket({ vix: 26 }));
    expect(elevated.vixSignal).toBe(0.5);
    expect(elevated.multiplier).toBe(1.5);

    const extreme = calculateMultiplier(baseMarket({ vix: 36 }));
    expect(extreme.vixSignal).toBe(1.0);
    expect(extreme.multiplier).toBe(2.0);
  });

  it("applies geo override floor to 2.0 when triggered", () => {
    const res = calculateMultiplier(
      baseMarket({
        niftyPE: 31,
        pe5yrAvg: 25,
        monthsBelow200DMA: 3,
        drawdownFrom52wHigh: 15,
      }),
    );

    expect(res.geoOverride).toBe(true);
    expect(res.multiplier).toBe(2.0);
  });

  it("enforces cap and floor boundaries", () => {
    const capped = calculateMultiplier(
      baseMarket({
        niftyPE: 17.5,
        pe5yrAvg: 22,
        niftyClose: 18_000,
        ma200: 19_500,
        vix: 36,
      }),
    );
    expect(capped.multiplier).toBe(4.0);

    const floored = calculateMultiplier(baseMarket({ niftyPE: 31, pe5yrAvg: 25 }));
    expect(floored.multiplier).toBe(0.5);
  });
});

