import "server-only";

import { calculateMultiplier } from "@/lib/signal-engine";
import type { MarketDataRow } from "@/lib/market-snapshot";
import { marketRowToSnapshot } from "@/lib/market-snapshot";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sendTelegramMessage } from "@/lib/telegram";

import {
  formatCronTelegramMessage,
  formatCronTelegramResend,
} from "./format-cron-telegram";
import {
  addIstCalendarDays,
  signalMonthFirstDayYmd,
  toIstYmd,
} from "./ist-dates";
import { sipDayMatchesTomorrow } from "./sip-match";

function subscriptionEligible(sub: {
  status: string | null;
  trial_ends_at: string | null;
}): boolean {
  if (sub.status === "active") {
    return true;
  }
  if (sub.status === "trial" && sub.trial_ends_at) {
    return new Date(sub.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

type SipConfigRow = {
  user_id: string;
  sip_date: number;
  base_sip_amount: number;
  profiles: {
    telegram_chat_id: string | null;
    subscriptions: SubscriptionRow | SubscriptionRow[] | null;
  } | null;
};

function subscriptionFromProfile(
  profile: SipConfigRow["profiles"],
): SubscriptionRow | null {
  if (!profile?.subscriptions) {
    return null;
  }
  const s = profile.subscriptions;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function normalizeSipRow(raw: {
  user_id: string;
  sip_date: number;
  base_sip_amount: number;
  profiles: unknown;
}): SipConfigRow {
  let profiles: SipConfigRow["profiles"] = null;
  if (raw.profiles != null) {
    const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
    profiles = p as SipConfigRow["profiles"];
  }
  return {
    user_id: raw.user_id,
    sip_date: raw.sip_date,
    base_sip_amount: raw.base_sip_amount,
    profiles,
  };
}

export async function bestEffortRefreshMarketData(): Promise<void> {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!raw) {
    return;
  }
  const base = raw.replace(/\/$/, "");
  try {
    await fetch(`${base}/api/market-data`, { method: "GET" });
  } catch {
    // best-effort only
  }
}

export async function executeDailyCronNotifications(): Promise<{
  ok: boolean;
  error?: string;
  notifyDate: string;
  tomorrow: string;
  signalMonth: string;
  processed: number;
  sent: number;
  skipped: number;
}> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const notifyDate = toIstYmd(now);
  const tomorrow = addIstCalendarDays(notifyDate, 1);
  const signalMonth = signalMonthFirstDayYmd(tomorrow);

  await bestEffortRefreshMarketData();

  const { data: marketRow, error: marketError } = await supabase
    .from("market_data")
    .select("date,nifty_close,nifty_pe,india_vix,ma_200,pe_5yr_avg")
    .lte("date", notifyDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle<MarketDataRow>();

  if (marketError) {
    return {
      ok: false,
      error: "MARKET_DATA_LOOKUP_FAILED",
      notifyDate,
      tomorrow,
      signalMonth,
      processed: 0,
      sent: 0,
      skipped: 0,
    };
  }

  if (!marketRow) {
    return {
      ok: false,
      error: "NO_MARKET_DATA",
      notifyDate,
      tomorrow,
      signalMonth,
      processed: 0,
      sent: 0,
      skipped: 0,
    };
  }

  const snapshot = marketRowToSnapshot(marketRow);
  const engineResult = calculateMultiplier(snapshot);

  const { data: sipRows, error: sipError } = await supabase
    .from("sip_configs")
    .select(
      "user_id, sip_date, base_sip_amount, updated_at, profiles ( telegram_chat_id, subscriptions ( status, trial_ends_at ) )",
    )
    .order("updated_at", { ascending: false });

  if (sipError) {
    return {
      ok: false,
      error: "SIP_CONFIGS_LOOKUP_FAILED",
      notifyDate,
      tomorrow,
      signalMonth,
      processed: 0,
      sent: 0,
      skipped: 0,
    };
  }

  const seen = new Set<string>();
  const candidates: SipConfigRow[] = [];
  for (const raw of sipRows ?? []) {
    const row = normalizeSipRow(
      raw as {
        user_id: string;
        sip_date: number;
        base_sip_amount: number;
        profiles: unknown;
      },
    );
    if (seen.has(row.user_id)) {
      continue;
    }
    seen.add(row.user_id);
    candidates.push(row);
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const row of candidates) {
    const subscription = subscriptionFromProfile(row.profiles);
    if (!subscription || !subscriptionEligible(subscription)) {
      skipped += 1;
      continue;
    }

    const chatId = row.profiles?.telegram_chat_id?.trim();
    if (!chatId) {
      skipped += 1;
      continue;
    }

    if (!sipDayMatchesTomorrow(row.sip_date, tomorrow)) {
      skipped += 1;
      continue;
    }

    processed += 1;

    const baseSip = row.base_sip_amount;
    const suggestedAmount = Math.round(baseSip * engineResult.multiplier);

    const { data: existing, error: existingError } = await supabase
      .from("signals")
      .select("*")
      .eq("user_id", row.user_id)
      .eq("signal_month", signalMonth)
      .maybeSingle();

    if (existingError) {
      skipped += 1;
      continue;
    }

    if (existing?.notification_sent) {
      skipped += 1;
      continue;
    }

    if (existing && !existing.notification_sent) {
      const text = formatCronTelegramResend({
        signalMonthFirstDayYmd: signalMonth,
        multiplier: Number(existing.multiplier),
        suggestedAmount: existing.suggested_amount,
      });
      await sendTelegramMessage(chatId, text);
      await supabase
        .from("signals")
        .update({ notification_sent: true })
        .eq("id", existing.id);
      sent += 1;
      continue;
    }

    const insertPayload = {
      user_id: row.user_id,
      signal_month: signalMonth,
      multiplier: engineResult.multiplier,
      base_sip_amount: baseSip,
      suggested_amount: suggestedAmount,
      pe_signal: engineResult.peSignal,
      trend_signal: engineResult.trendSignal,
      vix_signal: engineResult.vixSignal,
      geo_override: engineResult.geoOverride,
      nifty_pe_at_signal: marketRow.nifty_pe,
      vix_at_signal: marketRow.india_vix,
      nifty_close_at_signal: marketRow.nifty_close,
      ma_200_at_signal: marketRow.ma_200,
      notification_sent: false,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("signals")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("signals")
        .select("id, notification_sent, multiplier, suggested_amount")
        .eq("user_id", row.user_id)
        .eq("signal_month", signalMonth)
        .maybeSingle();

      if (raced?.notification_sent) {
        skipped += 1;
        continue;
      }
      if (raced?.id) {
        const text = formatCronTelegramResend({
          signalMonthFirstDayYmd: signalMonth,
          multiplier: Number(raced.multiplier),
          suggestedAmount: raced.suggested_amount,
        });
        await sendTelegramMessage(chatId, text);
        await supabase
          .from("signals")
          .update({ notification_sent: true })
          .eq("id", raced.id);
        sent += 1;
      }
      continue;
    }

    if (insertError || !inserted?.id) {
      skipped += 1;
      continue;
    }

    const text = formatCronTelegramMessage({
      signalMonthFirstDayYmd: signalMonth,
      multiplier: engineResult.multiplier,
      suggestedAmount,
      breakdown: engineResult.breakdown,
    });
    await sendTelegramMessage(chatId, text);
    await supabase
      .from("signals")
      .update({ notification_sent: true })
      .eq("id", inserted.id);
    sent += 1;
  }

  return {
    ok: true,
    notifyDate,
    tomorrow,
    signalMonth,
    processed,
    sent,
    skipped,
  };
}
