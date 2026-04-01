import { describe, expect, it } from "vitest";

import {
  bufferHealthTier,
  bufferMultiple,
  isBufferStale,
} from "./buffer-health";

describe("bufferMultiple", () => {
  it("returns null when buffer is null or base SIP is not positive", () => {
    expect(bufferMultiple(null, 1000)).toBeNull();
    expect(bufferMultiple(undefined, 1000)).toBeNull();
    expect(bufferMultiple(6000, 0)).toBeNull();
    expect(bufferMultiple(6000, -1)).toBeNull();
  });

  it("returns buffer ÷ base SIP", () => {
    expect(bufferMultiple(24_000, 4000)).toBe(6);
    expect(bufferMultiple(25_000, 4000)).toBe(6.25);
  });
});

describe("bufferHealthTier", () => {
  it("matches plan bands: healthy (>6×), caution (4–6×), low (<4×)", () => {
    expect(bufferHealthTier(6.1)).toBe("healthy");
    expect(bufferHealthTier(7)).toBe("healthy");
    expect(bufferHealthTier(6)).toBe("caution");
    expect(bufferHealthTier(5)).toBe("caution");
    expect(bufferHealthTier(4)).toBe("caution");
    expect(bufferHealthTier(3.9)).toBe("low");
    expect(bufferHealthTier(0)).toBe("low");
  });

  it("returns unknown for non-finite or null multiple", () => {
    expect(bufferHealthTier(null)).toBe("unknown");
    expect(bufferHealthTier(Number.NaN)).toBe("unknown");
  });
});

describe("isBufferStale", () => {
  it("is false when no timestamp", () => {
    expect(isBufferStale(null, new Date("2026-06-01"))).toBe(false);
    expect(isBufferStale(undefined, new Date("2026-06-01"))).toBe(false);
  });

  it("is true when last update is more than 90 days before now", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const ninetyOneDaysAgo = new Date("2026-03-02T12:00:00Z");
    expect(isBufferStale(ninetyOneDaysAgo.toISOString(), now)).toBe(true);
  });

  it("is false when within 90 days", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const eightyNineDaysAgo = new Date("2026-03-04T12:00:00Z");
    expect(isBufferStale(eightyNineDaysAgo.toISOString(), now)).toBe(false);
  });

  it("respects custom stale threshold", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const fiveDaysAgo = new Date("2026-06-05T12:00:00Z");
    expect(isBufferStale(fiveDaysAgo.toISOString(), now, 3)).toBe(true);
  });
});
