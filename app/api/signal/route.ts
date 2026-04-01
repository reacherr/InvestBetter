import { NextResponse } from "next/server";

import { buildSignalSuccessPayload } from "@/lib/signal-api";
import type { MarketDataRow } from "@/lib/market-snapshot";
import { createClient } from "@/lib/supabase/server";

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

    return NextResponse.json(buildSignalSuccessPayload(latest), { status: 200 });
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

