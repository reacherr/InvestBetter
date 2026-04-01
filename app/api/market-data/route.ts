import { NextResponse } from "next/server";

import {
  computeNifty200Dma,
  fetchNseMarketSnapshot,
  getIstDateString,
} from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";

type MarketDataPayload = {
  date: string;
  nifty_close: number;
  nifty_pe: number;
  india_vix: number;
  ma_200: number | null;
  pe_5yr_avg: number | null;
  fetched_at: string;
};

export async function GET() {
  const istDate = getIstDateString();

  try {
    const supabase = createClient();

    const { data: cached, error: cachedError } = await supabase
      .from("market_data")
      .select(
        "date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg,fetched_at",
      )
      .eq("date", istDate)
      .maybeSingle();

    if (cachedError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("market_data cache lookup failed", cachedError);
      }
      return NextResponse.json(
        { ok: false, error: "CACHE_LOOKUP_FAILED", date: istDate },
        { status: 500 },
      );
    }

    if (cached) {
      return NextResponse.json(
        { ok: true, source: "cache", date: istDate, data: cached },
        { status: 200 },
      );
    }

    const { asOfIstDate, niftyClose, niftyPE, indiaVix } =
      await fetchNseMarketSnapshot();

    // Enforce "no fake rows on weekend/holiday": only insert if NSE confirms today's date.
    // If NSE doesn't provide a parseable timestamp, we fail closed (no insert).
    if (!asOfIstDate || asOfIstDate !== istDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_TODAY_DATA",
          date: istDate,
          asOf: asOfIstDate,
        },
        { status: 503 },
      );
    }

    // Optional: compute 200DMA. If NSE history fetch is unavailable/blocked, we keep it null.
    let ma200: number | null = null;
    try {
      ma200 = await computeNifty200Dma();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("computeNifty200Dma failed; continuing with null", err);
      }
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

    const { data: inserted, error: insertError } = await supabase
      .from("market_data")
      .insert(payload)
      .select(
        "date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg,fetched_at",
      )
      .single();

    if (insertError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("market_data insert failed", insertError);
      }
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", date: istDate },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, source: "fresh", date: istDate, data: inserted },
      { status: 200 },
    );
  } catch (err) {
    // Critical: if NSE returns no data (holiday/weekend/blocked), we return an error and do NOT insert.
    if (process.env.NODE_ENV !== "production") {
      console.error("GET /api/market-data failed", err);
    }
    return NextResponse.json(
      { ok: false, error: "MARKET_DATA_UNAVAILABLE", date: istDate },
      { status: 503 },
    );
  }
}

