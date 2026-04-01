type Props = {
  niftyPe: number;
  indiaVix: number;
  niftyClose: number;
  ma200: number | null;
};

export function MarketDataStrip({ niftyPe, indiaVix, niftyClose, ma200 }: Props) {
  const below200 =
    ma200 != null && Number.isFinite(ma200)
      ? niftyClose < ma200
      : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Nifty PE
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {niftyPe.toFixed(2)}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          India VIX
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {indiaVix.toFixed(2)}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          vs 200-day average
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {below200 === null
            ? "—"
            : below200
              ? "Below long-term average"
              : "Above long-term average"}
        </p>
      </div>
    </div>
  );
}
