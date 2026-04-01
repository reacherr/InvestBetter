type Row = {
  name: string;
  amount: number;
  weight: number;
};

type Props = {
  rows: Row[];
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

export function FundSplitTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No fund allocations yet. Complete setup under Configure.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        Fund split (this month)
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Amounts use your weights and whether the multiplier applies to each fund.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Fund</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                  {r.name}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {r.weight}%
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatInr(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
