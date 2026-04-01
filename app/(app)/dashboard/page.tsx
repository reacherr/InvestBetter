import Link from "next/link";
import { redirect } from "next/navigation";

import { BufferHealthCard } from "@/components/signal/BufferHealthCard";
import { FundSplitTable } from "@/components/signal/FundSplitTable";
import { MarketDataStrip } from "@/components/signal/MarketDataStrip";
import { MultiplierDisplay } from "@/components/signal/MultiplierDisplay";
import { SignalBreakdown } from "@/components/signal/SignalBreakdown";
import type { MarketDataRow } from "@/lib/market-snapshot";
import { marketRowToSnapshot } from "@/lib/market-snapshot";
import {
  calculateFundDeployment,
  calculateMultiplier,
} from "@/lib/signal-engine";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DISCLAIMER =
  "This tool provides market-data-based SIP multiplier suggestions using publicly available indices. It does not constitute investment advice. InvestBetter is not a SEBI Registered Investment Adviser. Consult a financial advisor before making investment decisions.";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: sipRow } = await supabase
    .from("sip_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      base_sip_amount: number;
      buffer_amount: number | null;
      buffer_updated_at: string | null;
    }>();

  const { data: fundRows } = await supabase
    .from("fund_allocations")
    .select("fund_name, weight_percent, apply_multiplier")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: marketRow, error: marketError } = await supabase
    .from("market_data")
    .select("date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle<MarketDataRow>();

  if (!sipRow) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Set up your SIP and fund allocations first.
        </p>
        <Link
          href="/configure"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
        >
          Go to Configure
        </Link>
      </main>
    );
  }

  if (marketError || !marketRow) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Market data isn’t available yet. Try again after the daily snapshot is
          cached, or check `/api/market-data`.
        </p>
      </main>
    );
  }

  const snapshot = marketRowToSnapshot(marketRow);
  const signal = calculateMultiplier(snapshot);
  const suggestedAmount = Math.round(sipRow.base_sip_amount * signal.multiplier);

  const fundSplit =
    fundRows && fundRows.length > 0
      ? calculateFundDeployment(
          sipRow.base_sip_amount,
          signal.multiplier,
          fundRows.map((f) => ({
            name: f.fund_name,
            weightPercent: Number(f.weight_percent),
            applyMultiplier: Boolean(f.apply_multiplier ?? true),
          })),
        )
      : [];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Signal as of{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {marketRow.date}
            </span>{" "}
            (latest cached market data).
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/configure"
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Edit SIP & funds
          </Link>
          <Link
            href="/settings"
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <MultiplierDisplay
            multiplier={signal.multiplier}
            suggestedAmount={suggestedAmount}
          />
          <SignalBreakdown items={signal.breakdown} />
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Market snapshot
            </h2>
            <div className="mt-4">
              <MarketDataStrip
                niftyPe={marketRow.nifty_pe}
                indiaVix={marketRow.india_vix}
                niftyClose={marketRow.nifty_close}
                ma200={marketRow.ma_200}
              />
            </div>
          </div>
          <BufferHealthCard
            baseSip={sipRow.base_sip_amount}
            bufferAmount={sipRow.buffer_amount}
            bufferUpdatedAt={sipRow.buffer_updated_at}
          />
        </div>
      </div>

      <div className="mt-8">
        <FundSplitTable rows={fundSplit} />
      </div>

      <p className="mt-10 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {DISCLAIMER}
      </p>
    </main>
  );
}
