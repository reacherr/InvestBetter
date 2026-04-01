import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeNifty200Dma,
  fetchNseMarketSnapshot,
  getIstDateString,
} from "@/lib/market-data";

type MarketDataPayload = {
  date: string;
  nifty_close: number;
  nifty_pe: number;
  india_vix: number;
  ma_200: number | null;
  pe_5yr_avg: number | null;
  fetched_at: string;
};

/**
 * Ensures today's IST row exists in `market_data` when NSE reports today.
 * Caller should pass a client that can INSERT (e.g. service role); anon RLS may not allow writes.
 */
export async function ingestTodayMarketSnapshotIfMissing(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; source: "cache" }
  | { ok: true; source: "fresh" }
  | { ok: false; reason: string }
> {
  const istDate = getIstDateString();

  const { data: cached, error: cachedError } = await supabase
    .from("market_data")
    .select("date")
    .eq("date", istDate)
    .maybeSingle();

  if (cachedError) {
    return { ok: false, reason: "CACHE_LOOKUP_FAILED" };
  }

  if (cached) {
    return { ok: true, source: "cache" };
  }

  const { asOfIstDate, niftyClose, niftyPE, indiaVix } =
    await fetchNseMarketSnapshot();

  if (!asOfIstDate || asOfIstDate !== istDate) {
    return { ok: false, reason: "NO_TODAY_DATA" };
  }

  let ma200: number | null = null;
  try {
    ma200 = await computeNifty200Dma();
  } catch {
    // optional field
  }

  const payload: MarketDataPayload = {
    date: istDate,
    nifty_close: niftyClose,
    nifty_pe: niftyPE,
    india_vix: indiaVix,
    ma_200: ma200,
    pe_5yr_avg: null,
    fetched_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from("market_data")
    .upsert(payload, { onConflict: "date" });

  if (insertError) {
    return { ok: false, reason: "INSERT_FAILED" };
  }

  return { ok: true, source: "fresh" };
}
