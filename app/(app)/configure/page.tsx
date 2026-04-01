import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentIstMonthStartISODate } from "@/lib/ist";

import { ConfigureClient } from "./ConfigureClient";

export const dynamic = "force-dynamic";

type SipConfigRow = {
  id: string;
  user_id: string;
  base_sip_amount: number;
  monthly_surplus: number | null;
  sip_date: number;
  buffer_amount: number | null;
  buffer_updated_at?: string | null;
  date_change_count?: number | null;
  date_change_reset_month?: string | null;
};

type FundAllocationRow = {
  id: string;
  user_id: string;
  fund_name: string;
  fund_category: string | null;
  weight_percent: number;
  apply_multiplier: boolean | null;
};

export default async function ConfigurePage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: sipConfig } = await supabase
    .from("sip_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: fundAllocations } = await supabase
    .from("fund_allocations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);

  const currentResetMonth = getCurrentIstMonthStartISODate();
  const typedSipConfig = (sipConfig as SipConfigRow | null) ?? null;
  const typedFundAllocations =
    (fundAllocations as FundAllocationRow[] | null) ?? null;

  const storedResetMonth = typedSipConfig?.date_change_reset_month ?? null;
  const storedCount = typedSipConfig?.date_change_count ?? 0;
  const changesLeftThisMonth =
    storedResetMonth === currentResetMonth ? Math.max(0, 2 - storedCount) : 2;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Configure
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Set your SIP basics and how your monthly amount should be split
            across funds.
          </p>
        </div>
      </div>

      <ConfigureClient
        initialSipConfig={typedSipConfig}
        initialFundAllocations={typedFundAllocations ?? []}
        sipDateChangesLeftThisMonth={changesLeftThisMonth}
        currentResetMonth={currentResetMonth}
      />
    </main>
  );
}

