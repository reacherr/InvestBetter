# InvestBetter

Next.js 14 (App Router) + TypeScript (strict) + Tailwind scaffold for InvestBetter v1 MVP.

## Setup

- Copy env template:

```bash
cp .env.example .env.local
```

- Fill in the required keys in `.env.local`.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run build
```

## Database schema

- **Schema file**: `supabase/schema.sql`
- **Schema source-of-truth**: `investbetter-cursor-spec.md` + v1 deltas in `docs/superpowers/specs/2026-04-01-investbetter-v1-design.md`
- **Implementation plan** (Task 4): `docs/superpowers/plans/2026-04-01-investbetter-v1-mvp.md`

### Apply schema in Supabase (manual)

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Copy/paste the full contents of `supabase/schema.sql`.
3. Run it (it is ordered to execute top-to-bottom).

Notes:
- `sip_configs.sip_date` is **1–31**. App logic treats 29–31 as “overflow”: in short months, those users fire on the month’s last day.
- RLS is enabled for all tables; `market_data` is **public read** by policy.

### Quick RLS verification (manual)

- **Public read for `market_data`**:
  - With your project anon key (no user session), a `select` on `market_data` should succeed.
- **Private tables are user-scoped** (`profiles`, `sip_configs`, `fund_allocations`, `signals`, `subscriptions`):
  - Without a user session, reads/writes should be rejected by RLS.
  - With an authenticated user session, reads/writes should only work for rows where `user_id = auth.uid()` (or `id = auth.uid()` for `profiles`).

