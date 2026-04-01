import type { SignalBreakdownItem } from "@/lib/signal-engine";

type Props = {
  items: SignalBreakdownItem[];
};

function formatContribution(n: number) {
  if (n === 0) return "0";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}×`;
}

function statusStyles(status: SignalBreakdownItem["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300";
  }
}

export function SignalBreakdown({ items }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        Signal breakdown
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        How each signal contributes to the multiplier (no exact market thresholds
        shown).
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((row, i) => (
          <li
            key={`${row.signal}-${i}`}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${statusStyles(row.status)}`}
          >
            <div>
              <p className="font-medium">{row.signal}</p>
              <p className="mt-0.5 opacity-90">{row.condition}</p>
            </div>
            <span className="shrink-0 font-mono text-base font-semibold tabular-nums">
              {formatContribution(row.contribution)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
