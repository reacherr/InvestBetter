import { NextResponse } from "next/server";

import { calculateMultiplier, type MarketSnapshot } from "@/lib/signal-engine";
import { createClient } from "@/lib/supabase/server";

type MarketDataRow = {
  date: string;
  nifty_close: number;
  nifty_pe: number;
  india_vix: number;
  ma_200: number | null;
  pe_5yr_avg: number | null;
};

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: latest, error: latestError } = await supabase
      .from("market_data")
      .select("date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle<MarketDataRow>();

    if (latestError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("market_data latest lookup failed", latestError);
      }
      return NextResponse.json(
        { ok: false, error: "MARKET_DATA_LOOKUP_FAILED" },
        { status: 500 },
      );
    }

    if (!latest) {
      return NextResponse.json(
        { ok: false, error: "MARKET_DATA_UNAVAILABLE" },
        { status: 503 },
      );
    }

    const snapshot: MarketSnapshot = {
      niftyPE: latest.nifty_pe,
      pe5yrAvg: latest.pe_5yr_avg ?? latest.nifty_pe,
      niftyClose: latest.nifty_close,
      ma200: latest.ma_200 ?? latest.nifty_close,
      vix: latest.india_vix,
      monthsBelow200DMA: 0,
      drawdownFrom52wHigh: 0,
    };

    const result = calculateMultiplier(snapshot);

    return NextResponse.json(
      {
        ok: true,
        asOf: latest.date,
        multiplier: result.multiplier,
        peSignal: result.peSignal,
        trendSignal: result.trendSignal,
        vixSignal: result.vixSignal,
        geoOverride: result.geoOverride,
        breakdown: result.breakdown,
      },
      { status: 200 },
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("GET /api/signal failed", err);
    }
    return NextResponse.json(
      { ok: false, error: "SIGNAL_UNAVAILABLE" },
      { status: 503 },
    );
  }
}

