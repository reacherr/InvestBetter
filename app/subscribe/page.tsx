import Link from "next/link";
import { redirect } from "next/navigation";

import { getSubscription, isActiveOrTrial } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  razorpay: "Payment could not be started. Please try again in a moment.",
  save: "We couldn’t save your billing profile. Please try again.",
  config: "Subscriptions aren’t configured yet (missing plan id or keys).",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function SubscribePage({ searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const subscription = await getSubscription(user.id);
  if (subscription && isActiveOrTrial(subscription)) {
    redirect("/dashboard");
  }

  const errRaw = searchParams.error;
  const errKey = typeof errRaw === "string" ? errRaw : undefined;
  const errorMessage = errKey ? ERROR_COPY[errKey] ?? "Something went wrong." : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Subscribe to InvestBetter
      </h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Your trial has ended or your subscription is inactive. Choose a plan to
        keep using the dashboard, signals, and Telegram reminders.
      </p>

      {errorMessage ? (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          Monthly plan
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>— SIP multiplier signal and generic breakdown</li>
          <li>— Dashboard and fund split guidance</li>
          <li>— SIP-date-minus-one Telegram reminders (when configured)</li>
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="/api/subscribe/checkout"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Pay with Razorpay
          </a>
          <Link
            href="/api/auth/logout"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            Switch account
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          You’ll complete payment on Razorpay’s secure page. By subscribing you
          agree to Razorpay’s terms; InvestBetter does not provide investment
          advice.
        </p>
      </div>
    </main>
  );
}
