/**
 * Pure buffer health rules: healthy (>6×), caution (4–6×), low (<4×).
 */
export type BufferHealthTier = "healthy" | "caution" | "low" | "unknown";

export function bufferMultiple(
  bufferAmount: number | null | undefined,
  baseSip: number,
): number | null {
  if (bufferAmount == null || !Number.isFinite(bufferAmount)) {
    return null;
  }
  if (!(baseSip > 0) || !Number.isFinite(baseSip)) {
    return null;
  }
  return bufferAmount / baseSip;
}

export function bufferHealthTier(multiple: number | null): BufferHealthTier {
  if (multiple == null || !Number.isFinite(multiple)) {
    return "unknown";
  }
  if (multiple > 6) {
    return "healthy";
  }
  if (multiple >= 4) {
    return "caution";
  }
  return "low";
}

export function isBufferStale(
  bufferUpdatedAt: string | null | undefined,
  now: Date,
  staleAfterDays = 90,
): boolean {
  if (bufferUpdatedAt == null || bufferUpdatedAt === "") {
    return false;
  }
  const updated = new Date(bufferUpdatedAt);
  if (!Number.isFinite(updated.getTime())) {
    return false;
  }
  const days = Math.floor(
    (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24),
  );
  return days > staleAfterDays;
}
