-- InvestBetter (v1 MVP) — Supabase Postgres schema
-- Apply in Supabase SQL editor (top-to-bottom).

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Users (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  telegram_chat_id text,
  created_at timestamptz default now()
);

-- SIP Configuration per user
create table if not exists public.sip_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  base_sip_amount integer not null,          -- in rupees, e.g. 18000
  monthly_surplus integer,                   -- optional, for buffer calc
  sip_date integer not null default 1,       -- day of month (1-31); dates 29-31 fire on last day of short months

  -- v1 deltas
  date_change_count integer not null default 0,
  date_change_reset_month date,
  buffer_amount integer,
  buffer_updated_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint sip_configs_sip_date_range check (sip_date between 1 and 31)
);

-- Fund allocations per user
create table if not exists public.fund_allocations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  fund_name text not null,
  fund_category text,                        -- 'flexi_cap', 'index', 'gold', 'small_cap', etc.
  weight_percent numeric not null,           -- 0-100, must sum to 100 per user (enforced in app for v1)
  apply_multiplier boolean default true,     -- false for gold
  created_at timestamptz default now(),

  constraint fund_allocations_weight_range check (weight_percent >= 0 and weight_percent <= 100)
);

-- Daily market data cache
create table if not exists public.market_data (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  nifty_close numeric not null,
  nifty_pe numeric not null,
  india_vix numeric not null,
  ma_200 numeric,                            -- calculated from last 200 trading days
  pe_5yr_avg numeric,                        -- rolling 5-year average PE
  is_below_200dma boolean generated always as (nifty_close < ma_200) stored,
  pe_ratio_vs_avg numeric generated always as (nifty_pe / nullif(pe_5yr_avg, 0)) stored,
  fetched_at timestamptz default now()
);

-- Monthly signals (one per user per month)
create table if not exists public.signals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  signal_month date not null,                -- first day of month, e.g. 2026-04-01
  multiplier numeric not null,               -- final multiplier, e.g. 2.5
  base_sip_amount integer not null,
  suggested_amount integer not null,         -- base * multiplier, rounded
  pe_signal numeric,                         -- contribution from PE, e.g. +0.5
  trend_signal numeric,                      -- contribution from 200DMA, e.g. +1.0
  vix_signal numeric,                        -- contribution from VIX, e.g. +0.5
  geo_override boolean default false,
  nifty_pe_at_signal numeric,
  vix_at_signal numeric,
  nifty_close_at_signal numeric,
  ma_200_at_signal numeric,
  notification_sent boolean default false,
  user_followed boolean,                     -- null until user marks it
  created_at timestamptz default now(),

  constraint signals_user_month_unique unique(user_id, signal_month)
);

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  status text not null default 'trial',      -- 'trial', 'active', 'cancelled', 'expired'
  plan text default 'monthly',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  razorpay_subscription_id text,
  razorpay_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.sip_configs enable row level security;
alter table public.fund_allocations enable row level security;
alter table public.market_data enable row level security;
alter table public.signals enable row level security;
alter table public.subscriptions enable row level security;

-- Policies (match spec intent: users only see their own rows; market_data is public read)
drop policy if exists "Users can only access own data" on public.profiles;
create policy "Users can only access own data"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can only access own data" on public.sip_configs;
create policy "Users can only access own data"
  on public.sip_configs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can only access own data" on public.fund_allocations;
create policy "Users can only access own data"
  on public.fund_allocations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can only access own data" on public.signals;
create policy "Users can only access own data"
  on public.signals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can only access own data" on public.subscriptions;
create policy "Users can only access own data"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Market data is public read" on public.market_data;
create policy "Market data is public read"
  on public.market_data
  for select
  using (true);

