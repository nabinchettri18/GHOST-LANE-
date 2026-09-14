create table if not exists public.ghostlane_daily_analysis (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references public.lanes(id) on delete cascade,
  analyzed_at timestamptz not null default now(),
  observation_days integer not null default 0,
  actual_volume numeric not null default 0,
  expected_volume numeric not null default 0,
  realization_rate numeric,
  trend_change numeric,
  ghost_probability numeric not null,
  risk_level text not null,
  confidence text not null default 'low',
  warning text,
  recommendation text,
  drivers jsonb not null default '[]'::jsonb,
  unique(lane_id, analyzed_at)
);

create index if not exists ghostlane_daily_analysis_lane_time_idx
  on public.ghostlane_daily_analysis(lane_id, analyzed_at desc);

create table if not exists public.ghostlane_alerts (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references public.lanes(id) on delete cascade,
  created_at timestamptz not null default now(),
  alert_type text not null default 'ghost_risk',
  severity text not null,
  title text not null,
  message text not null,
  ghost_probability numeric not null,
  previous_probability numeric,
  recommendation text,
  acknowledged_at timestamptz
);

create index if not exists ghostlane_alerts_lane_time_idx
  on public.ghostlane_alerts(lane_id, created_at desc);

alter table public.ghostlane_daily_analysis enable row level security;
alter table public.ghostlane_alerts enable row level security;

create policy "org members can read daily ghost analysis"
  on public.ghostlane_daily_analysis for select
  using (exists (
    select 1 from public.lanes l
    where l.id = ghostlane_daily_analysis.lane_id
  ));

create policy "org members can read ghost alerts"
  on public.ghostlane_alerts for select
  using (exists (
    select 1 from public.lanes l
    where l.id = ghostlane_alerts.lane_id
  ));
