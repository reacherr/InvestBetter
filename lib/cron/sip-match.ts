import { daysInMonth, istDateStringToParts } from "./ist-dates";

/**
 * Whether the user's SIP day-of-month (1–31) fires on `tomorrowYmd` (IST),
 * including 29–31 overflow on the last day of short months.
 */
export function sipDayMatchesTomorrow(
  sipDate: number,
  tomorrowYmd: string,
): boolean {
  const { year, month, day } = istDateStringToParts(tomorrowYmd);
  const dim = daysInMonth(year, month);

  if (sipDate === day) {
    return true;
  }

  if (day === dim && sipDate > dim) {
    return true;
  }

  return false;
}
