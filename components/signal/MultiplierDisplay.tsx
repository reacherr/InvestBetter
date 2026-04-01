type Props = {
  multiplier: number;
  suggestedAmount: number | null;
  currency?: string;
};

function formatInr(amount: number) {
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

export function MultiplierDisplay({
  multiplier,
  suggestedAmount,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Suggested multiplier
      </p>
      <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">
        {multiplier.toFixed(1)}×
      </p>
      {suggestedAmount != null ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Suggested monthly deployment:{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {formatInr(suggestedAmount)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
