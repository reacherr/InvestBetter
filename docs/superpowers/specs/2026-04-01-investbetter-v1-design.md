# InvestBetter v1 — Design (Option A MVP)

Date: 2026-04-01  
Scope: v1 paid MVP (Option A) — Auth + Configure + Dashboard + Subscribe + Cron + Telegram notifications  

## Summary

InvestBetter is a web app that suggests a monthly SIP multiplier for Indian mutual fund investors, based on cached market signals. v1 focuses on a fast path to subscription revenue with:

- Google-only login (Supabase Auth)
- SIP configuration (base SIP + SIP date + fund weights)
- Dashboard showing the current month’s suggested multiplier and fund split
- Telegram notifications sent **the evening before** the user’s SIP date
- Hard paywall after a 2-month trial
- Razorpay subscription lifecycle via webhook

Compliance: the product is a calculator based on market data and **not investment advice**; UI copy must avoid advisory language and always show the required disclaimer.

**v1 lock (timing):** Notifications are sent on **SIP date − 1** after market close, so users have the evening before + the SIP day to act. (Some earlier project notes described “on SIP date”; v1 uses SIP date − 1.)

## Goals / non-goals

- **Goals**
  - Shipping a working, paid v1 end-to-end on Vercel
  - Idempotent cron that is safe on retries/duplicates
  - Keep signal thresholds/weights/formula server-side (IP protection)

- **Non-goals (v1)**
  - Backtest page
  - Email notifications (Telegram-only in v1)
  - Advanced “notification day preference” UX beyond SIP-date-driven timing

## Tech choices

- **Frontend / server**: Next.js 14 App Router, TypeScript (strict), Tailwind
- **DB/Auth**: Supabase Postgres + Supabase Auth (Google OAuth only)
- **Payments**: Razorpay subscriptions + webhook
- **Notifications**: Telegram Bot API
- **Cron**: Vercel Cron hitting a Next.js route handler
- **Market data**: NSE India fetch + daily Supabase cache (`market_data`)

## Core entities (data model)

Source of truth remains `investbetter-cursor-spec.md`. v1 uses these key tables:

- `profiles`: user profile + `telegram_chat_id`
- `sip_configs`: `base_sip_amount`, optional `monthly_surplus`, `sip_date` (1–31)
  - Dates 29–31 fire on the last day for short months.
- `fund_allocations`: user funds, weights, `apply_multiplier` toggle (e.g., gold off)
- `market_data`: daily cache of Nifty close, PE, VIX, 200DMA (+ derived fields)
- `signals`: one per user per month: `unique(user_id, signal_month)` and `notification_sent`
- `subscriptions`: trial/active/cancelled/expired + Razorpay ids

### Signal month rule (locked)

`signals.signal_month` is always the **first day of the month in which the SIP executes**, not the month the notification was sent.

- Example: SIP date = 1st  
  Notification sent: Mar 31  
  `signal_month`: Apr 1 (`YYYY-04-01`)

General rule:

- `signal_month = first day of month containing the user’s SIP date`

## Pages & route groups (v1)

### Public (marketing)

- `/(marketing)/page.tsx`: landing page (simple v1)
- `/login`: “Continue with Google”
- `/subscribe`: plan CTA + Razorpay checkout initiation

### Protected app

- `/configure`: two-step setup
  - Step 1: base SIP, optional surplus, SIP date (1–31), buffer balance
  - Step 2: fund weights (must sum to 100) + apply-multiplier toggle
- `/dashboard`: server-rendered dashboard
  - Multiplier + suggested amount
  - Signal breakdown (generic; no thresholds/cutoffs)
  - Fund split amounts
  - Buffer health card
- `/settings` (minimal v1)
  - Telegram connect (store `telegram_chat_id`)
  - Billing status / manage subscription entry point

## Auth & paywall (hard blocking)

### Auth

- Supabase Auth with Google OAuth
- On first login:
  - Insert `profiles` row (id = auth uid)
  - Insert `subscriptions` row in `trial` with `trial_ends_at = now + 60 days`

### Paywall

Hard-block access when not active and trial expired:

- Any route under `/(app)` requires an active subscription or unexpired trial.
- If not eligible: redirect to `/subscribe`.

Enforcement layers:

- `middleware.ts`: protects `/(app)` routes and redirects unauthenticated users to `/login`.
- Server-side checks in `/(app)/layout.tsx` for subscription state (defense in depth).

## API routes (v1)

### `GET /api/market-data`

Responsibility:

- Fetch NSE market snapshot and write a row in `market_data` for “today” **when available**.
- If the market is closed and today’s data isn’t available (holiday/weekend), do not create fake rows; consumers will naturally fall back to the most recent row.

### `GET /api/signal`

Responsibility:

- Requires auth (user session).
- Reads most recent cached market snapshot (and ensures cache is up-to-date if appropriate).
- Computes the multiplier server-side using `lib/signal-engine.ts`.
- Returns:
  - `multiplier`, `peSignal`, `trendSignal`, `vixSignal`, `geoOverride`
  - `breakdown` items **without revealing thresholds/weights**

**IP protection requirement**

- Do not return numeric cutoffs or formula details.
- Breakdown `condition` strings must be generic (no “PE > 30”, no “VIX > 25”, etc.).

### `POST /api/webhooks/razorpay`

Responsibility:

- Verify Razorpay webhook signature.
- Update `subscriptions` table on:
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.cancelled`

### `POST /api/cron` (single daily cron)

Schedule (Vercel):

- Daily at **11:00 UTC (4:30pm IST)**.

Responsibility:

1. Verify cron secret
2. Fetch/cache market data after close (best-effort)
3. Determine which users to notify (those whose SIP date is **tomorrow**)
4. Compute and store signal for the SIP month
5. Send Telegram notification
6. Mark `notification_sent=true`

#### SIP-date-driven notification timing (locked)

- **Timezone rule (critical):** all `today`/`tomorrow`/`daysInMonth` computations are done in **Asia/Kolkata (IST)**. Do not use server-local or UTC date boundaries for selection.

- Users get notified **the evening before** their SIP date.
- Let:
  - `today = cron run date` (notification day)
  - `tomorrow = today + 1 day` (the SIP execution date)
  - `signal_month = first day of month containing tomorrow`

Notify this run:

- All users where `sip_date == day(tomorrow)`  
- Plus “overflow” SIP dates (29–31) when tomorrow is the last day of a short month:
  - if `day(tomorrow) == daysInMonth(tomorrowMonth)`, also include users with `sip_date > daysInMonth`.

#### Holiday/weekend handling (locked)

Multiplier snapshot date:

- `notifyDate = today`
- `snapshotDate = most recent trading day on or before notifyDate`

Implementation:

- Query `market_data` for the latest row with `date <= notifyDate` and use that.
- Since holidays/weekends have no row, the query naturally returns the last available trading day.
- If no eligible `market_data` row exists yet (fresh database / fetch failure), skip processing for the run and emit an error for investigation (do not insert “fake” rows).

## Cron idempotency & deduplication (locked)

The cron must be safe under:

- Vercel retries
- duplicate executions
- partial failures (DB insert succeeded but Telegram send failed)

Rules:

- `signals` has a unique constraint on `(user_id, signal_month)` as a final backstop.
- Cron logic must explicitly dedupe to avoid wasted work.
- Notification sending must be driven by `notification_sent`.

Recommended algorithm (high level):

1. Compute `tomorrow` and `signal_month`.
2. Fetch `usersToNotify` based on SIP-date rules above.
3. Fetch existing `signals` for these users for `signal_month` in one query; map by `user_id`.
4. For each user:
   - If existing signal exists and `notification_sent=true`: skip.
   - If existing signal exists and `notification_sent=false`: **re-send using stored signal values**; then mark sent.
   - If no signal exists: compute once, insert with `notification_sent=false`, send, then mark sent.
5. If an insert races and fails due to uniqueness, re-fetch the row and apply the same notification_sent logic.

## Telegram notifications (v1)

- If `profiles.telegram_chat_id` is missing, skip sending and do not insert a `signals` row for that user-month (avoids infinite resend retries until Telegram is connected).
- Message contents:
  - Month label (derived from `signal_month`)
  - Suggested multiplier + suggested amount
  - Short generic breakdown bullets (no thresholds)
  - Reminder: “This is not investment advice” disclaimer snippet

**IP protection:** Do not include numeric thresholds/cutoffs in any output surface: `/api/signal`, dashboard props, cron logs, or Telegram messages.

## Security / secrets

- Public env vars only for Supabase URL + anon key.
- Server-only secrets:
  - Supabase service role key (cron + server routes that need elevated reads)
  - Razorpay secrets + webhook secret
  - Telegram bot token
  - `CRON_SECRET`

## Build order for v1 (implementation sequence)

1. Next.js app scaffold (TS strict + Tailwind)
2. Supabase SSR client setup (`@supabase/ssr`)
3. Auth (Google OAuth) + middleware protection
4. Database schema applied in Supabase + basic RLS verification
5. Configure flow (save `sip_configs`, `fund_allocations`)
6. Market data fetch + cache (`/api/market-data`)
7. Signal engine server-side + `/api/signal` (generic breakdown)
8. Dashboard UI
9. Telegram connect + send primitive
10. Daily cron (`/api/cron`) with SIP-date-minus-one and idempotency rules
11. Razorpay subscribe flow + webhook + hard paywall

## Open items (explicitly deferred)

- Email notifications (Resend)
- Backtest and history UX polish
- Admin tooling for monitoring cron and notifications

