# InvestBetter v1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship InvestBetter v1 (Option A) on Vercel: Google auth, SIP configuration, dashboard, SIP-date-minus-one Telegram notifications via daily cron, and Razorpay subscriptions with hard paywall.

**Architecture:** Single Next.js 14 App Router app (Server Components by default) deployed to Vercel. Supabase provides Auth + Postgres; server-side route handlers use service role only where needed (cron, privileged reads). Market data is cached daily in `market_data`, signals stored monthly in `signals`, and Telegram notifications are sent the evening before each user’s SIP date using IST date math.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), Tailwind, Supabase (`@supabase/ssr`), Razorpay, Telegram Bot API, Vercel Cron.

---

## Target file structure (created/modified by this plan)

**Create (high-level):**

- `package.json`, `next.config.*`, `tsconfig.json`, `tailwind.config.*`, `postcss.config.*`
- `app/layout.tsx`, `app/globals.css`
- `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`
- `app/login/page.tsx`
- `app/subscribe/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/configure/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/api/auth/callback/route.ts` (if needed for OAuth flow glue)
- `app/api/market-data/route.ts`
- `app/api/signal/route.ts`
- `app/api/cron/route.ts`
- `app/api/webhooks/razorpay/route.ts`
- `components/ui/*` (Button, Input, Card, Badge, Tabs, etc.)
- `components/layout/AppShell.tsx`, `components/layout/Sidebar.tsx`
- `components/signal/*` (MultiplierDisplay, SignalBreakdown, FundSplitTable, BufferHealthCard)
- `lib/supabase/client.ts`, `lib/supabase/server.ts`
- `lib/auth.ts` (session/user helpers)
- `lib/subscription.ts` (getSubscription, isActive logic)
- `lib/signal-engine.ts` (server-only; thresholds never exposed)
- `lib/market-data.ts` (NSE fetch + normalization)
- `lib/cron/ist-dates.ts` (IST today/tomorrow helpers)
- `lib/telegram.ts`
- `lib/razorpay.ts`
- `types/index.ts`
- `middleware.ts`
- `vercel.json`
- `.env.example`
- `README.md`

**Modify:**

- `docs/superpowers/specs/2026-04-01-investbetter-v1-design.md` (only if plan reveals missing decisions)

---

## Task 1: Scaffold Next.js 14 + Tailwind + TS strict

**Files:**
- Create: standard Next.js app scaffold under repo root
- Create: `app/layout.tsx`, `app/globals.css`
- Create: Tailwind + PostCSS configs
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Scaffold the app**
Run:

```bash
npm create next-app@latest . -- --ts --tailwind --eslint --app --src-dir=false --import-alias \"@/*\"\n```

Expected:
- `app/` directory exists (App Router)
- TypeScript enabled

- [ ] **Step 2: Enable TypeScript strict mode**
Edit `tsconfig.json`:
- set `"strict": true`

- [ ] **Step 3: Add `.env.example`**
Include all required env vars from the spec + design doc:
- Supabase (public + service role)
- Razorpay
- Telegram
- Cron secret
- `NEXT_PUBLIC_APP_URL`

- [ ] **Step 4: Run typecheck + lint**
Run:

```bash
npm run lint
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**
Run:

```bash
git add .
git commit -m \"chore: scaffold Next.js app\"
```

---

## Task 2: Supabase setup (SSR clients + env wiring)

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `types/supabase.ts` (optional; can defer)

- [ ] **Step 1: Add dependencies**
Run:

```bash
npm i @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Implement Supabase browser client**
Create `lib/supabase/client.ts` (uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

- [ ] **Step 3: Implement Supabase server client**
Create `lib/supabase/server.ts` using `@supabase/ssr` and Next cookies/headers patterns for App Router.

- [ ] **Step 4: Smoke test**
Add a temporary server component snippet (or route handler) to verify the server client can create and read a session (remove after verification).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase
git commit -m \"chore: add Supabase SSR clients\"
```

---

## Task 3: Auth (Google OAuth) + middleware protection

**Files:**
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `lib/auth.ts`
- Create: `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`
- Modify: `app/(app)/layout.tsx` (enforce subscription check)

- [ ] **Step 1: Implement login page**
UI: “Continue with Google” button.
On click: triggers Supabase OAuth sign-in (Google).

- [ ] **Step 2: Middleware session gate**
Protect `/(app)` routes:
- no session → redirect `/login`

- [ ] **Step 3: First-login provisioning**
After OAuth sign-in (server-side):
- ensure `profiles` row exists
- ensure `subscriptions` row exists with `trial` + `trial_ends_at = now()+60d`

- [ ] **Step 4: Post-login routing**
- if no `sip_configs` → redirect `/configure`
- else `/dashboard`

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/login lib/auth.ts app/(marketing)
git commit -m \"feat: add Google auth and route protection\"
```

---

## Task 4: Supabase schema + RLS + v1 schema deltas

**Files:**
- Create: `supabase/schema.sql` (copy from spec + add v1 deltas)
- Docs: update `README.md` with “apply schema” steps

- [ ] **Step 1: Create `supabase/schema.sql`**
Include:
- tables from `investbetter-cursor-spec.md`
- add v1 deltas on `sip_configs`:
  - `date_change_count`, `date_change_reset_month`
  - `buffer_amount`, `buffer_updated_at`
  - ensure `sip_date` semantics match (1–31 overflow)

- [ ] **Step 2: Apply in Supabase**
Manual step: paste into Supabase SQL editor in order.

- [ ] **Step 3: Quick RLS verification**
Manual check:
- authenticated user can read/write their own rows
- `market_data` is public read

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql README.md
git commit -m \"docs: add Supabase schema and v1 deltas\"
```

---

## Task 5: Subscription model + hard paywall + `/subscribe`

**Files:**
- Create: `lib/subscription.ts`
- Create: `app/subscribe/page.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Implement `getSubscription(userId)`**
Reads `subscriptions` row.

- [ ] **Step 2: Implement `isActiveOrTrial(subscription)`**
Active when:
- status = `active`, OR
- status = `trial` and `trial_ends_at` in future

- [ ] **Step 3: Enforce hard paywall**
In `app/(app)/layout.tsx`, if not active/trial → redirect `/subscribe`.

- [ ] **Step 4: Build `/subscribe` placeholder**
v1 can start with UI + “coming soon” button if Razorpay not wired yet; later tasks wire it fully.

- [ ] **Step 5: Commit**

```bash
git add lib/subscription.ts app/subscribe app/(app)/layout.tsx
git commit -m \"feat: add hard paywall and subscribe page\"
```

---

## Task 6: Configure flow (SIP config + fund allocations)

**Files:**
- Create: `app/(app)/configure/page.tsx`
- Create: `components/ui/*` primitives used by forms
- Create: `types/index.ts`

- [ ] **Step 1: SIP config form**
Fields:
- base SIP amount (rupees)
- monthly surplus (optional)
- SIP date (1–31) with helper copy
- buffer amount (rupees) with confirmation on save
- show buffer last-updated (`buffer_updated_at`) if present

- [ ] **Step 2: SIP date change cap (2 per calendar month)**
Server-side enforcement when updating `sip_date`:
- if `date_change_reset_month` != first-of-current-month (IST), reset `date_change_count=0` and set reset_month
- if changing `sip_date` and `date_change_count >= 2`, reject
- if changing `sip_date` and allowed, increment count

Client-side UX:
- show “X changes left this month” (derived from stored count + reset month)

- [ ] **Step 3: Fund allocation table**
- fund name, category, weight %, apply-multiplier toggle
- validate weights sum to 100
- prefill suggested portfolio

- [ ] **Step 4: Persist to Supabase**
Upsert:
- single `sip_configs` row per user (decide: 1 row; enforce with unique constraint or fetch latest)
- fund allocations: replace-all strategy for v1 (delete then insert) to keep simple

- [ ] **Step 5: Commit**

```bash
git add app/(app)/configure components types
git commit -m \"feat: add configure flow for SIP and fund allocation\"
```

---

## Task 7: Market data cache (`/api/market-data`)

**Files:**
- Create: `app/api/market-data/route.ts`
- Create: `lib/market-data.ts`

- [ ] **Step 1: Implement NSE fetch**
Implement cookie/session header handling (NSE often blocks naive requests).

- [ ] **Step 2: Cache to Supabase**
Insert `market_data` for “today” (IST date) when available.
Do not create rows for holidays/weekends.

- [ ] **Step 3: Manual verification**
Run locally:

```bash
curl -s http://localhost:3000/api/market-data | jq
```

Expected: JSON with cached snapshot (or a clear error).

- [ ] **Step 4: Commit**

```bash
git add app/api/market-data lib/market-data.ts
git commit -m \"feat: add market data fetch and daily cache\"
```

---

## Task 8: Signal engine (server-only) + `/api/signal` (generic breakdown)

**Files:**
- Create: `lib/signal-engine.ts`
- Create: `app/api/signal/route.ts`
- Create: `lib/signal-breakdown.ts` (optional helper to “sanitize” breakdown text)

- [ ] **Step 1: Write tests for `calculateMultiplier()`**
Create:
- `lib/signal-engine.test.ts` (or `__tests__/signal-engine.test.ts`) using the project’s chosen test runner.
If no test runner exists yet, add one (Vitest recommended for TS) and wire `npm test`.

- [ ] **Step 2: Implement `calculateMultiplier()` server-side**
Copy logic from the source spec, then **sanitize** all user-facing `condition` strings to remove thresholds/cutoffs.

- [ ] **Step 3: Implement `/api/signal`**
- Auth required
- Load most recent `market_data` row (latest date)
- Compute multiplier
- Return only safe breakdown + final numbers

- [ ] **Step 4: Commit**

```bash
git add lib/signal-engine* app/api/signal
git commit -m \"feat: add server-only signal engine and signal API\"
```

---

## Task 9: Dashboard UI

**Files:**
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/signal/MultiplierDisplay.tsx`
- Create: `components/signal/SignalBreakdown.tsx`
- Create: `components/signal/FundSplitTable.tsx`
- Create: `components/signal/BufferHealthCard.tsx`

- [ ] **Step 1: Build server-rendered dashboard**
Fetch:
- user SIP config
- fund allocations
- current signal via internal server call or direct function call (preferred: call the engine directly server-side rather than fetching from `/api/signal` inside RSC)

- [ ] **Step 2: Buffer health**
Compute `buffer_amount / base_sip_amount` and render states:
- healthy (> 6×), caution (4–6×), low (< 4×)
Also show staleness nudge if `buffer_updated_at` is old.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/dashboard components/signal
git commit -m \"feat: add dashboard multiplier and buffer health UI\"
```

---

## Task 10: Telegram integration + settings

**Files:**
- Create: `lib/telegram.ts`
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Telegram send helper**
Implement:
- `sendTelegramMessage(chatId, text)`

- [ ] **Step 2: Settings UI**
- input `telegram_chat_id`
- store to `profiles`
- show a “Send test message” action (optional; helpful for setup)

- [ ] **Step 3: Commit**

```bash
git add lib/telegram.ts app/(app)/settings
git commit -m \"feat: add Telegram setup and send helper\"
```

---

## Task 11: Daily cron (`/api/cron`) with IST date math + idempotency

**Files:**
- Create: `app/api/cron/route.ts`
- Create: `lib/cron/ist-dates.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Implement IST date helpers**
Helpers to compute:
- IST “today” date
- IST “tomorrow” date
- `daysInMonth(ISTMonth)`

- [ ] **Step 2: Implement cron route**
Behavior (from design doc):
- verify `Authorization: Bearer CRON_SECRET`
- best-effort fetch/cache market data
- select users with SIP date matching tomorrow (overflow handling for 29–31)
- compute `signal_month` = first day of month containing tomorrow
- prefetch existing signals for this `signal_month`
- per user:
  - if `telegram_chat_id` missing: skip and do not insert signal
  - if signal exists + sent: skip
  - if signal exists + not sent: re-send using stored values; mark sent
  - else: compute once, insert with sent=false, send, mark sent

- [ ] **Step 3: Configure Vercel cron**
Create `vercel.json`:
- path `/api/cron`
- schedule `0 11 * * *` (11:00 UTC)

- [ ] **Step 4: Commit**

```bash
git add app/api/cron lib/cron vercel.json
git commit -m \"feat: add daily cron for SIP-date-minus-one notifications\"
```

---

## Task 12: Razorpay subscription integration + webhook

**Files:**
- Create: `lib/razorpay.ts`
- Create: `app/api/webhooks/razorpay/route.ts`
- Modify: `app/subscribe/page.tsx`

- [ ] **Step 1: Create Razorpay helpers**
Create customer + subscription, return checkout details.

- [ ] **Step 2: Webhook verification + updates**
Update `subscriptions` row based on events.

- [ ] **Step 3: Wire `/subscribe`**
Implement “Subscribe” CTA that starts the subscription and directs user to Razorpay checkout.

- [ ] **Step 4: Commit**

```bash
git add lib/razorpay.ts app/api/webhooks/razorpay app/subscribe
git commit -m \"feat: add Razorpay subscriptions and webhook\"
```

---

## Task 13: Verification pass (before release)

**Files:**
- Modify: as needed

- [ ] **Step 1: Run full build**

```bash
npm run lint
npm run build
```

- [ ] **Step 2: Manual test checklist**
- Login with Google
- Configure SIP + funds, save, revisit dashboard
- Connect Telegram and send test message
- Simulate cron locally (call `/api/cron` with header) and confirm:
  - correct user selection for tomorrow
  - idempotency on repeat calls
  - no thresholds shown in Telegram message
- Subscribe via Razorpay test mode and confirm paywall behavior

- [ ] **Step 3: Commit final fixes**

```bash
git add .
git commit -m \"chore: v1 verification fixes\"
```

