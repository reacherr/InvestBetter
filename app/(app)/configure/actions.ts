"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentIstMonthStartISODate } from "@/lib/ist";

type UpdateSipConfigInput = {
  base_sip_amount: number;
  monthly_surplus: number | null;
  sip_date: number;
  buffer_amount: number | null;
  buffer_confirmed: boolean;
};

type SaveFundAllocationsInput = {
  allocations: Array<{
    fund_name: string;
    fund_category: string | null;
    weight_percent: number;
    apply_multiplier: boolean;
  }>;
};

function normalizeIntOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function assertPositiveInt(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertIntInRange(name: string, value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
}

export async function updateSipConfig(input: UpdateSipConfigInput) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in to save settings.");
  }

  const baseSip = normalizeIntOrNull(input.base_sip_amount);
  const monthlySurplus = normalizeIntOrNull(input.monthly_surplus);
  const sipDate = normalizeIntOrNull(input.sip_date);
  const bufferAmount = normalizeIntOrNull(input.buffer_amount);

  if (baseSip === null) throw new Error("Base SIP amount is required.");
  if (sipDate === null) throw new Error("SIP date is required.");

  assertPositiveInt("Base SIP amount", baseSip);
  assertIntInRange("SIP date", sipDate, 1, 31);

  if (monthlySurplus !== null && monthlySurplus < 0) {
    throw new Error("Monthly surplus must be a non-negative integer (or empty).");
  }
  if (bufferAmount !== null && bufferAmount < 0) {
    throw new Error("Buffer amount must be a non-negative integer (or empty).");
  }

  const { data: existing } = await supabase
    .from("sip_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      sip_date: number;
      buffer_amount?: number | null;
      date_change_count?: number | null;
      date_change_reset_month?: string | null;
    }>();

  const currentResetMonth = getCurrentIstMonthStartISODate();

  const storedResetMonth = existing?.date_change_reset_month ?? null;
  const storedCount = existing?.date_change_count ?? 0;

  const resetMonthForWrite =
    storedResetMonth === currentResetMonth ? storedResetMonth : currentResetMonth;
  const countForMonth = storedResetMonth === currentResetMonth ? storedCount : 0;

  const sipDateChanged = existing ? existing.sip_date !== sipDate : false;
  const nextCount = sipDateChanged ? countForMonth + 1 : countForMonth;

  if (sipDateChanged && countForMonth >= 2) {
    throw new Error(
      "You’ve used all SIP date changes for this month (2 max). Try again next month.",
    );
  }

  const bufferChanged = (existing?.buffer_amount ?? null) !== bufferAmount;
  if (bufferChanged && !input.buffer_confirmed) {
    throw new Error("Please confirm before updating your buffer amount.");
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    base_sip_amount: baseSip,
    monthly_surplus: monthlySurplus,
    sip_date: sipDate,
    buffer_amount: bufferAmount,
    date_change_reset_month: resetMonthForWrite,
    date_change_count: nextCount,
    updated_at: new Date().toISOString(),
  };

  if (bufferChanged) {
    payload.buffer_updated_at = new Date().toISOString();
  }

  const { error: upsertError } = await supabase
    .from("sip_configs")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    const msg = upsertError.message ?? "";
    const looksLikeMissingUnique =
      msg.includes("no unique") ||
      msg.includes("no unique or exclusion constraint") ||
      msg.includes("42P10");

    if (!looksLikeMissingUnique) {
      throw new Error(upsertError.message);
    }

    // If there's no unique constraint on user_id yet, fall back to update/insert.
    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("sip_configs")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase.from("sip_configs").insert(payload);
      if (insertError) throw new Error(insertError.message);
    }
  }

  revalidatePath("/configure");
  return { ok: true as const };
}

export async function saveFundAllocations(input: SaveFundAllocationsInput) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in to save settings.");
  }

  const allocations = input.allocations ?? [];
  if (allocations.length === 0) {
    throw new Error("Please add at least one fund allocation.");
  }

  const normalized = allocations.map((row) => {
    const fund_name = row.fund_name?.trim();
    const weight_percent = Number(row.weight_percent);
    const apply_multiplier = Boolean(row.apply_multiplier);
    const fund_category =
      row.fund_category === null
        ? null
        : String(row.fund_category ?? "")
            .trim()
            .toLowerCase() || null;

    if (!fund_name) throw new Error("Fund name is required.");
    if (!Number.isFinite(weight_percent) || weight_percent < 0 || weight_percent > 100) {
      throw new Error("Each weight must be a number between 0 and 100.");
    }

    return { fund_name, fund_category, weight_percent, apply_multiplier };
  });

  const total = normalized.reduce((sum, row) => sum + row.weight_percent, 0);
  const roundedTotal = Math.round(total * 1000) / 1000;
  if (Math.abs(roundedTotal - 100) > 0.0001) {
    throw new Error("Weights must sum to 100%.");
  }

    const { error: rpcError } = await supabase.rpc("replace_fund_allocations", {
      p_allocations: normalized,
    });

  if (rpcError) {
    // Fallback for environments where the RPC hasn't been applied yet.
    const msg = rpcError.message ?? "";
    const missingFn =
      msg.includes("function") && (msg.includes("does not exist") || msg.includes("42883"));

    if (!missingFn) {
      throw new Error(rpcError.message);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("fund_allocations")
      .insert(
        normalized.map((row) => ({
          user_id: user.id,
          ...row,
        })),
      )
      .select("id")
      .limit(1000);

    if (insertError) throw new Error(insertError.message);

    if (inserted?.length) {
      const keepIds = inserted.map((r) => r.id);
      const { error: deleteError } = await supabase
        .from("fund_allocations")
        .delete()
        .eq("user_id", user.id)
        .not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);

      if (deleteError) throw new Error(deleteError.message);
    }
  }

  revalidatePath("/configure");
  return { ok: true as const };
}

