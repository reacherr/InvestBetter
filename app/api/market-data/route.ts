import { NextResponse } from "next/server";

import { ingestTodayMarketSnapshotIfMissing } from "@/lib/market-data-ingest";
import { getIstDateString } from "@/lib/market-data";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function GET() {
  const istDate = getIstDateString();

  try {
    const supabase = createServiceRoleClient();
    const ingest = await ingestTodayMarketSnapshotIfMissing(supabase);

    if (!ingest.ok) {
      if (ingest.reason === "NO_TODAY_DATA") {
        return NextResponse.json(
          {
            ok: false,
            error: "NO_TODAY_DATA",
            date: istDate,
          },
          { status: 503 },
        );
      }
      if (ingest.reason === "CACHE_LOOKUP_FAILED") {
        return NextResponse.json(
          { ok: false, error: "CACHE_LOOKUP_FAILED", date: istDate },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { ok: false, error: ingest.reason, date: istDate },
        { status: 500 },
      );
    }

    const { data: row, error: rowError } = await supabase
      .from("market_data")
      .select(
        "date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg,fetched_at",
      )
      .eq("date", istDate)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json(
        { ok: false, error: "ROW_READ_FAILED", date: istDate },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        source: ingest.source,
        date: istDate,
        data: row,
      },
      { status: 200 },
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("GET /api/market-data failed", err);
    }
    return NextResponse.json(
      { ok: false, error: "MARKET_DATA_UNAVAILABLE", date: istDate },
      { status: 503 },
    );
  }
}
