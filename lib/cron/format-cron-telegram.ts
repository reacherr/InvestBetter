import type { SignalBreakdownItem } from "@/lib/signal-engine";

import { istDateStringToParts } from "./ist-dates";

function formatMonthHeading(signalMonthFirstDayYmd: string): string {
  const { year, month } = istDateStringToParts(signalMonthFirstDayYmd);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function formatCronTelegramMessage(params: {
  signalMonthFirstDayYmd: string;
  multiplier: number;
  suggestedAmount: number;
  breakdown: SignalBreakdownItem[];
}): string {
  const heading = formatMonthHeading(params.signalMonthFirstDayYmd);
  const lines = [
    `InvestBetter — ${heading}`,
    `Suggested multiplier: ${params.multiplier}×`,
    `Suggested SIP amount: ₹${params.suggestedAmount.toLocaleString("en-IN")}`,
    "",
    ...params.breakdown.map((b) => `• ${b.signal}: ${b.condition}`),
    "",
    "This is not investment advice. Consult a financial advisor before investing.",
  ];
  return lines.join("\n");
}

/** When re-sending a row that failed to deliver earlier — use DB values, not a fresh engine run. */
export function formatCronTelegramResend(params: {
  signalMonthFirstDayYmd: string;
  multiplier: number;
  suggestedAmount: number;
}): string {
  const heading = formatMonthHeading(params.signalMonthFirstDayYmd);
  const lines = [
    `InvestBetter — ${heading}`,
    `Suggested multiplier: ${params.multiplier}×`,
    `Suggested SIP amount: ₹${params.suggestedAmount.toLocaleString("en-IN")}`,
    "",
    "Multiplier reflects valuation, trend, and volatility signals (see the app for details).",
    "",
    "This is not investment advice. Consult a financial advisor before investing.",
  ];
  return lines.join("\n");
}
