import { calculateMultiplier } from "@/lib/signal-engine";
import { marketRowToSnapshot, type MarketDataRow } from "@/lib/market-snapshot";

/** JSON body for a successful `GET /api/signal` response (200). */
export function buildSignalSuccessPayload(latest: MarketDataRow) {
  const result = calculateMultiplier(marketRowToSnapshot(latest));

  return {
    ok: true as const,
    asOf: latest.date,
    multiplier: result.multiplier,
    peSignal: result.peSignal,
    trendSignal: result.trendSignal,
    vixSignal: result.vixSignal,
    geoOverride: result.geoOverride,
    breakdown: result.breakdown,
  };
}
