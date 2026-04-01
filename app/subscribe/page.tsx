export default function SubscribePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Subscribe to InvestBetter
      </h1>
      <p className="mt-4 text-sm text-neutral-600">
        You’re currently not on an active plan. Subscription payments aren’t
        enabled yet in this MVP, but they’re coming soon.
      </p>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-base font-medium">What you’ll get</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>- SIP multiplier signal and breakdown</li>
          <li>- Dashboard and portfolio split guidance</li>
          <li>- SIP-date-minus-one Telegram reminders</li>
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white opacity-60"
          >
            Subscribe (coming soon)
          </button>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium"
          >
            Switch account
          </a>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Payment integration will be added in a later task (Razorpay).
        </p>
      </div>
    </main>
  );
}

