import {
  bufferHealthTier,
  bufferMultiple,
  isBufferStale,
  type BufferHealthTier,
} from "@/lib/buffer-health";

type Props = {
  baseSip: number;
  bufferAmount: number | null;
  bufferUpdatedAt: string | null;
};

function healthLabel(h: BufferHealthTier) {
  switch (h) {
    case "healthy":
      return "Healthy";
    case "caution":
      return "Caution";
    case "low":
      return "Low";
    default:
      return "—";
  }
}

function healthClass(h: BufferHealthTier) {
  switch (h) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "caution":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100";
    case "low":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300";
  }
}

export function BufferHealthCard({
  baseSip,
  bufferAmount,
  bufferUpdatedAt,
}: Props) {
  const multiple = bufferMultiple(bufferAmount, baseSip);
  const health = bufferHealthTier(multiple);
  const updated = bufferUpdatedAt ? new Date(bufferUpdatedAt) : null;
  const stale = isBufferStale(bufferUpdatedAt, new Date());

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${healthClass(health)}`}
    >
      <h2 className="text-base font-semibold">Buffer health</h2>
      <p className="mt-1 text-sm opacity-90">
        Buffer ÷ base SIP ≈{" "}
        <span className="font-semibold tabular-nums">
          {multiple != null ? `${multiple.toFixed(1)}×` : "—"}
        </span>
      </p>
      <p className="mt-2 text-sm">
        Status: <span className="font-semibold">{healthLabel(health)}</span>
        {health === "healthy" ? " (> 6×)" : null}
        {health === "caution" ? " (4–6×)" : null}
        {health === "low" ? " (under 4×)" : null}
      </p>
      {updated ? (
        <p className="mt-3 text-xs opacity-80">
          Last updated: {updated.toLocaleDateString("en-IN")}
        </p>
      ) : (
        <p className="mt-3 text-xs opacity-80">Buffer not set yet.</p>
      )}
      {stale ? (
        <p className="mt-2 text-xs font-medium">
          Your buffer balance was last updated 90+ days ago — is it still
          accurate?
        </p>
      ) : null}
    </div>
  );
}
