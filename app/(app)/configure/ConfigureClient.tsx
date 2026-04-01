"use client";

import { useMemo, useState, useTransition } from "react";

import { saveFundAllocations, updateSipConfig } from "./actions";

type SipConfig = {
  base_sip_amount: number;
  monthly_surplus: number | null;
  sip_date: number;
  buffer_amount: number | null;
  buffer_updated_at?: string | null;
  date_change_count?: number | null;
  date_change_reset_month?: string | null;
};

type FundAllocation = {
  fund_name: string;
  fund_category: string | null;
  weight_percent: number;
  apply_multiplier: boolean;
};

const DEFAULT_ALLOCATIONS: FundAllocation[] = [
  {
    fund_name: "PPFAS Flexi Cap",
    fund_category: "flexi_cap",
    weight_percent: 29,
    apply_multiplier: true,
  },
  {
    fund_name: "Quant Multi Asset",
    fund_category: "multi_asset",
    weight_percent: 21,
    apply_multiplier: true,
  },
  {
    fund_name: "Gold",
    fund_category: "gold",
    weight_percent: 21,
    apply_multiplier: false,
  },
  {
    fund_name: "Nifty 50",
    fund_category: "index",
    weight_percent: 11,
    apply_multiplier: false,
  },
  {
    fund_name: "Midcap 150",
    fund_category: "mid_cap",
    weight_percent: 9,
    apply_multiplier: true,
  },
  {
    fund_name: "Small Cap",
    fund_category: "small_cap",
    weight_percent: 6,
    apply_multiplier: true,
  },
  {
    fund_name: "Global AI",
    fund_category: "global",
    weight_percent: 3,
    apply_multiplier: true,
  },
];

function formatRupees(amount: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function ConfigureClient(props: {
  initialSipConfig: SipConfig | null;
  initialFundAllocations: Array<{
    fund_name: string;
    fund_category: string | null;
    weight_percent: number;
    apply_multiplier: boolean | null;
  }>;
  sipDateChangesLeftThisMonth: number;
  currentResetMonth: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();

  const [sip, setSip] = useState(() => {
    const initial = props.initialSipConfig;
    return {
      base_sip_amount: initial?.base_sip_amount?.toString?.() ?? "",
      monthly_surplus:
        initial?.monthly_surplus === null || initial?.monthly_surplus === undefined
          ? ""
          : String(initial.monthly_surplus),
      sip_date: initial?.sip_date?.toString?.() ?? "1",
      buffer_amount:
        initial?.buffer_amount === null || initial?.buffer_amount === undefined
          ? ""
          : String(initial.buffer_amount),
    };
  });

  const initialBufferAmount = props.initialSipConfig?.buffer_amount ?? null;
  const currentBufferAmount = parseNumberOrNull(sip.buffer_amount);
  const bufferChanged = initialBufferAmount !== currentBufferAmount;

  const [bufferConfirmed, setBufferConfirmed] = useState(false);
  const [sipError, setSipError] = useState<string | null>(null);
  const [sipSuccess, setSipSuccess] = useState<string | null>(null);

  const [allocations, setAllocations] = useState<FundAllocation[]>(() => {
    if (props.initialFundAllocations.length > 0) {
      return props.initialFundAllocations.map((a) => ({
        fund_name: a.fund_name,
        fund_category: a.fund_category,
        weight_percent: Number(a.weight_percent),
        apply_multiplier: Boolean(a.apply_multiplier ?? true),
      }));
    }
    return DEFAULT_ALLOCATIONS;
  });

  const weightsTotal = useMemo(() => {
    const total = allocations.reduce(
      (sum, row) => sum + (Number(row.weight_percent) || 0),
      0,
    );
    return Math.round(total * 100) / 100;
  }, [allocations]);

  const weightsOk = Math.abs(weightsTotal - 100) < 0.0001;

  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

  const bufferUpdatedAt = props.initialSipConfig?.buffer_updated_at
    ? new Date(props.initialSipConfig.buffer_updated_at)
    : null;
  const bufferIsStale =
    bufferUpdatedAt !== null && daysBetween(new Date(), bufferUpdatedAt) > 90;

  function updateAllocation(idx: number, patch: Partial<FundAllocation>) {
    setAllocations((prev) => {
      const next = prev.slice();
      const candidate = { ...next[idx], ...patch };
      if (
        patch.fund_category !== undefined &&
        String(patch.fund_category || "")
          .trim()
          .toLowerCase() === "gold"
      ) {
        candidate.apply_multiplier = false;
      }
      next[idx] = candidate;
      return next;
    });
  }

  function addAllocation() {
    setAllocations((prev) => [
      ...prev,
      {
        fund_name: "",
        fund_category: "",
        weight_percent: 0,
        apply_multiplier: true,
      },
    ]);
  }

  function removeAllocation(idx: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSaveStep1() {
    setSipError(null);
    setSipSuccess(null);

    startTransition(async () => {
      try {
        await updateSipConfig({
          base_sip_amount: Number(sip.base_sip_amount),
          monthly_surplus: parseNumberOrNull(sip.monthly_surplus),
          sip_date: Number(sip.sip_date),
          buffer_amount: parseNumberOrNull(sip.buffer_amount),
          buffer_confirmed: bufferChanged ? bufferConfirmed : true,
        });

        setSipSuccess("Saved.");
        setBufferConfirmed(false);
      } catch (e) {
        setSipError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  async function onSaveStep2() {
    setAllocError(null);
    setAllocSuccess(null);

    startTransition(async () => {
      try {
        await saveFundAllocations({
          allocations: allocations.map((a) => ({
            fund_name: a.fund_name,
            fund_category: a.fund_category ? a.fund_category : null,
            weight_percent: Number(a.weight_percent),
            apply_multiplier: Boolean(a.apply_multiplier),
          })),
        });
        setAllocSuccess("Saved.");
      } catch (e) {
        setAllocError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  const step1CanSave =
    !isPending &&
    Boolean(sip.base_sip_amount.trim()) &&
    Boolean(sip.sip_date.trim()) &&
    (!bufferChanged || bufferConfirmed);

  const step2CanSave = !isPending && allocations.length > 0 && weightsOk;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`rounded-full px-3 py-1 transition ${
            step === 1
              ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          Step 1: SIP basics
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`rounded-full px-3 py-1 transition ${
            step === 2
              ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          Step 2: Fund allocations
        </button>
      </div>

      {step === 1 ? (
        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                SIP basics
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                These settings drive your monthly suggested amount and notification timing.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Base SIP amount (₹) <span className="text-red-600">*</span>
              </div>
              <input
                inputMode="numeric"
                value={sip.base_sip_amount}
                onChange={(e) =>
                  setSip((s) => ({ ...s, base_sip_amount: e.target.value }))
                }
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="18000"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                The baseline amount you invest monthly (in rupees).
              </p>
            </label>

            <label className="block">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Monthly surplus (₹)
              </div>
              <input
                inputMode="numeric"
                value={sip.monthly_surplus}
                onChange={(e) =>
                  setSip((s) => ({ ...s, monthly_surplus: e.target.value }))
                }
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="(optional)"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Optional. Helps you keep the buffer healthy over time.
              </p>
            </label>

            <label className="block">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                SIP date (1–31) <span className="text-red-600">*</span>
              </div>
              <input
                inputMode="numeric"
                value={sip.sip_date}
                onChange={(e) => setSip((s) => ({ ...s, sip_date: e.target.value }))}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="1"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                If you choose 29–31, short months execute on the last day. You have{" "}
                <span className="font-medium">
                  {props.sipDateChangesLeftThisMonth}
                </span>{" "}
                changes left this month.
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Counter resets on {props.currentResetMonth} (IST). Frequent changes can
                undermine the strategy’s discipline.
              </p>
            </label>

            <label className="block">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Buffer amount (₹)
              </div>
              <input
                inputMode="numeric"
                value={sip.buffer_amount}
                onChange={(e) =>
                  setSip((s) => ({ ...s, buffer_amount: e.target.value }))
                }
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="(optional)"
              />
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {bufferUpdatedAt ? (
                  <span>
                    Last updated{" "}
                    <span className="font-medium">
                      {bufferUpdatedAt.toLocaleDateString("en-IN")}
                    </span>
                  </span>
                ) : (
                  <span>Not updated yet.</span>
                )}
                {bufferIsStale ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    Your buffer balance was last updated 90+ days ago — is it still accurate?
                  </span>
                ) : null}
              </div>
            </label>
          </div>

          {bufferChanged ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={bufferConfirmed}
                  onChange={(e) => setBufferConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-amber-400 accent-amber-600"
                />
                <span>
                  Confirm you’ve transferred{" "}
                  <span className="font-semibold">
                    {typeof currentBufferAmount === "number"
                      ? formatRupees(currentBufferAmount)
                      : "this amount"}
                  </span>{" "}
                  into your arbitrage buffer.
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveStep1}
              disabled={!step1CanSave}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Continue to fund allocations
            </button>
            {sipSuccess ? (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                {sipSuccess}
              </span>
            ) : null}
            {sipError ? (
              <span className="text-sm text-red-600 dark:text-red-400">
                {sipError}
              </span>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-950">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Fund allocations
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Weights must sum to 100%. You can also choose whether each fund should
                get the monthly multiplier applied.
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="text-zinc-900 dark:text-zinc-100">
                Total:{" "}
                <span className={weightsOk ? "font-semibold" : "font-semibold text-red-600 dark:text-red-400"}>
                  {weightsTotal}%
                </span>
              </div>
              {!weightsOk ? (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Weights must sum to 100% to save.
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Looks good.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Fund name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Weight (%)</th>
                  <th className="px-4 py-3">Apply multiplier</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {allocations.map((row, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        value={row.fund_name}
                        onChange={(e) =>
                          updateAllocation(idx, { fund_name: e.target.value })
                        }
                        className="h-10 w-72 max-w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        placeholder="e.g., Parag Parikh Flexi Cap Fund"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.fund_category ?? ""}
                        onChange={(e) =>
                          updateAllocation(idx, { fund_category: e.target.value })
                        }
                        className="h-10 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        placeholder="index"
                      />
                      {String(row.fund_category || "").toLowerCase() === "gold" ? (
                        <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Tip: Gold is usually excluded from the multiplier.
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="decimal"
                        value={String(row.weight_percent)}
                        onChange={(e) =>
                          updateAllocation(idx, {
                            weight_percent: Number(e.target.value),
                          })
                        }
                        className="h-10 w-28 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.apply_multiplier}
                          onChange={(e) =>
                            updateAllocation(idx, {
                              apply_multiplier: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-zinc-100"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-200">
                          Yes
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeAllocation(idx)}
                        className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addAllocation}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Add fund
            </button>

            <button
              type="button"
              onClick={onSaveStep2}
              disabled={!step2CanSave}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving…" : "Save allocations"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Back to SIP basics
            </button>

            {allocSuccess ? (
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                {allocSuccess}
              </span>
            ) : null}
            {allocError ? (
              <span className="text-sm text-red-600 dark:text-red-400">
                {allocError}
              </span>
            ) : null}
          </div>

          {allocError ? null : allocSuccess ? null : !weightsOk ? (
            <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Tip: Adjust weights until the total reaches exactly 100%.
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

