import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { unixSecondsToIso, verifyWebhookSignature } from "./razorpay";

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("accepts a valid HMAC-SHA256 hex signature", () => {
    const body = '{"event":"test"}';
    const expected = crypto
      .createHmac("sha256", "test_webhook_secret")
      .update(body)
      .digest("hex");

    expect(verifyWebhookSignature(body, expected)).toBe(true);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
  });

  it("returns false when signature is missing", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });
});

describe("unixSecondsToIso", () => {
  it("converts unix seconds to ISO string", () => {
    expect(unixSecondsToIso(1_700_000_000)).toBe(
      new Date(1_700_000_000 * 1000).toISOString(),
    );
  });

  it("returns null for invalid input", () => {
    expect(unixSecondsToIso(null)).toBeNull();
    expect(unixSecondsToIso(Number.NaN)).toBeNull();
    expect(unixSecondsToIso("x")).toBeNull();
  });
});
