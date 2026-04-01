/** All calendar math for cron uses Asia/Kolkata (IST). */

export const IST_TIMEZONE = "Asia/Kolkata";

export function toIstYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format IST date");
  }

  return `${year}-${month}-${day}`;
}

export function istDateStringToParts(ymd: string): {
  year: number;
  month: number;
  day: number;
} {
  const [ys, ms, ds] = ymd.split("-");
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    throw new Error(`Invalid IST date string: ${ymd}`);
  }
  return { year, month, day };
}

/** Days in calendar month `month` (1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Add signed calendar days using IST date string YYYY-MM-DD (no time component). */
export function addIstCalendarDays(ymd: string, delta: number): string {
  if (delta === 0) {
    return ymd;
  }

  let { year, month, day } = istDateStringToParts(ymd);
  let remaining = delta;
  const step = remaining > 0 ? 1 : -1;

  while (remaining !== 0) {
    if (step > 0) {
      const dim = daysInMonth(year, month);
      if (day < dim) {
        day += 1;
        remaining -= 1;
      } else {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        remaining -= 1;
      }
    } else {
      if (day > 1) {
        day -= 1;
        remaining += 1;
      } else {
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        day = daysInMonth(year, month);
        remaining += 1;
      }
    }
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First day of the calendar month containing `ymd` (IST). */
export function signalMonthFirstDayYmd(ymd: string): string {
  const { year, month } = istDateStringToParts(ymd);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
