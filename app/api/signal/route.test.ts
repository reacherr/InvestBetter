import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function mockMarketDataChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ order });
  return {
    from: vi.fn().mockReturnValue({ select }),
  };
}

describe("GET /api/signal", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("returns 401 when there is no user", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      ...mockMarketDataChain({ data: null, error: null }),
    } as ReturnType<typeof createClient>);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("returns 500 when market_data query fails", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1" } },
          error: null,
        }),
      },
      ...mockMarketDataChain({
        data: null,
        error: { message: "db error" },
      }),
    } as ReturnType<typeof createClient>);

    try {
      const res = await GET();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        ok: false,
        error: "MARKET_DATA_LOOKUP_FAILED",
      });
    } finally {
      logError.mockRestore();
    }
  });

  it("returns 503 when market_data is empty", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1" } },
          error: null,
        }),
      },
      ...mockMarketDataChain({ data: null, error: null }),
    } as ReturnType<typeof createClient>);

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: "MARKET_DATA_UNAVAILABLE",
    });
  });

  it("returns 200 with signal payload when user and market row exist", async () => {
    const row = {
      date: "2026-04-01",
      nifty_close: 20_000,
      nifty_pe: 22,
      india_vix: 15,
      ma_200: 19_500,
      pe_5yr_avg: 22,
    };
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1" } },
          error: null,
        }),
      },
      ...mockMarketDataChain({ data: row, error: null }),
    } as ReturnType<typeof createClient>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.asOf).toBe("2026-04-01");
    expect(typeof body.multiplier).toBe("number");
    expect(Array.isArray(body.breakdown)).toBe(true);
  });
});
