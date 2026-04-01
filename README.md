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

- Current schema source-of-truth: `investbetter-cursor-spec.md`
- Implementation plan (Task 4 creates `supabase/schema.sql`): `docs/superpowers/plans/2026-04-01-investbetter-v1-mvp.md`
