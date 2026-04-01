import { describe, expect, it } from "vitest";

import {
  bufferHealthTier,
  bufferMultiple,
  isBufferStale,
} from "./buffer-health";

describe("bufferMultiple", () => {
  it("returns null when buffer is null or base SIP is not positive", () => {
    expect(bufferMultiple(null, 1000)).toBeNull();
    expect(bufferMultiple(6000, 0)).toBeNull();
  });

  it("returns buffer ÷ base SIP", () => {
    expect(bufferMultiple(24_000, 4000)).toBe(6);
  });
});

describe("bufferHealthTier", () => {
  it("matches plan bands", () => {
    expect(bufferHealthTier(6.1)).toBe("healthy");
    expect(bufferHealthTier(5)).toBe("caution");
    expect(bufferHealthTier(3)).toBe("low");
  });
});

describe("isBufferStale", () => {
  it("is true when last update is more than 90 days before now", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const old = new Date("2026-03-01T12:00:00Z");
    expect(isBufferStale(old.toISOString(), now)).toBe(true);
  });
});
