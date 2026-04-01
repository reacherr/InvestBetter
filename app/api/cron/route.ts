import { NextResponse, type NextRequest } from "next/server";

import { executeDailyCronNotifications } from "@/lib/cron/execute-cron";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handleCron(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await executeDailyCronNotifications();
    if (!result.ok) {
      const status =
        result.error === "NO_MARKET_DATA" || result.error === "MARKET_DATA_LOOKUP_FAILED"
          ? 503
          : 500;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("cron failed", err);
    }
    return NextResponse.json({ ok: false, error: "CRON_FAILED" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
