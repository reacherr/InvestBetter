import type { MarketSnapshot } from "@/lib/signal-engine";

export type MarketDataRow = {
  date: string;
  nifty_close: number;
  nifty_pe: number;
  india_vix: number;
  ma_200: number | null;
  pe_5yr_avg: number | null;
};

/**
 * Maps a cached `market_data` row to the engine snapshot.
 * `monthsBelow200DMA` / `drawdownFrom52wHigh` are not stored in v1 cache yet — geo override stays inert until ingested.
 */
export function marketRowToSnapshot(row: MarketDataRow): MarketSnapshot {
  return {
    niftyPE: row.nifty_pe,
    pe5yrAvg: row.pe_5yr_avg ?? row.nifty_pe,
    niftyClose: row.nifty_close,
    ma200: row.ma_200 ?? row.nifty_close,
    vix: row.india_vix,
    monthsBelow200DMA: 0,
    drawdownFrom52wHigh: 0,
  };
}
