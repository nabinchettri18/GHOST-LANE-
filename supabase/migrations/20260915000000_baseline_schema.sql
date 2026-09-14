-- GhostLane AI: Canonical Multi-Tenant Schema Baseline Migration
-- Version: 1.0 (PRD & Technical Architecture Spec + Operations Flowcharts)

-- ============================================================================
-- 1. Helper Functions for RLS & Authorization
-- ============================================================================

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- ============================================================================
-- 2. Organization & User Tenancy
-- ============================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  role text default 'operator',
  default_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'operator', 'viewer')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_members_user_idx on public.organization_members (user_id);
create index if not exists org_members_org_idx on public.organization_members (organization_id);

-- ============================================================================
-- 3. Core Operational Master Entities (Locations, Carriers, Lanes, Contracts, Rates)
-- ============================================================================

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  country text default 'India',
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now()
);

create index if not exists locations_org_idx on public.locations (organization_id);
create index if not exists locations_city_state_idx on public.locations (city, state);

create table if not exists public.carriers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  carrier text,
  code text,
  acceptance_rate numeric default 100,
  rejection_rate numeric default 0,
  cancellation_rate numeric default 0,
  realization_rate numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists carriers_org_idx on public.carriers (organization_id);

create table if not exists public.lanes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  origin text not null,
  destination text not null,
  origin_location_id uuid references public.locations(id) on delete set null,
  destination_location_id uuid references public.locations(id) on delete set null,
  mode text not null default 'road',
  distance_km numeric,
  contracted_volume numeric not null default 0,
  materialized_volume numeric not null default 0,
  carrier text,
  risk_score numeric default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, origin, destination, mode)
);

create index if not exists lanes_org_idx on public.lanes (organization_id);
create index if not exists lanes_org_risk_idx on public.lanes (organization_id, risk_score desc);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id text not null,
  lane_id uuid not null references public.lanes(id) on delete cascade,
  carrier text not null,
  contracted_volume numeric not null default 0,
  contract_rate numeric,
  start_date text,
  end_date text,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_id)
);

create index if not exists contracts_org_lane_idx on public.contracts (organization_id, lane_id);

create table if not exists public.rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lane_id uuid not null references public.lanes(id) on delete cascade,
  carrier_id uuid references public.carriers(id) on delete set null,
  amount numeric not null,
  currency text not null default 'INR',
  effective_at timestamptz not null default now(),
  source text default 'historical',
  created_at timestamptz not null default now()
);

create index if not exists rates_org_lane_idx on public.rates (organization_id, lane_id);

-- ============================================================================
-- 4. Shipments, Stops & Live Execution
-- ============================================================================

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shipment_id text not null,
  lane_id uuid not null references public.lanes(id) on delete cascade,
  external_id text,
  carrier text not null,
  shipment_date text,
  volume numeric not null default 0,
  weight numeric,
  dimensions jsonb,
  equipment_type text,
  status text not null default 'created',
  expected_cost numeric,
  actual_cost numeric,
  expected_transit_hours numeric,
  actual_transit_hours numeric,
  eta_date text,
  delivered_at timestamptz,
  exception_type text,
  risk_score numeric default 0,
  notes text,
  ghost_lane_score numeric,
  ghost_lane_status text,
  ghost_lane_reason text,
  ghost_lane_confidence numeric,
  live_lat numeric,
  live_lng numeric,
  current_eta timestamptz,
  current_route text,
  last_event_at timestamptz,
  help_status text default 'none',
  vehicle_capacity numeric,
  vehicle_id text,
  priority text default 'standard',
  time_window_start timestamptz,
  time_window_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, shipment_id)
);

create index if not exists shipments_org_lane_idx on public.shipments (organization_id, lane_id);
create index if not exists shipments_org_status_idx on public.shipments (organization_id, status);
create index if not exists shipments_org_date_idx on public.shipments (organization_id, shipment_date desc);

create table if not exists public.shipment_stops (
  id uuid primary key default gen_random_uuid(),
  shipment_id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence integer not null,
  location_id uuid references public.locations(id) on delete set null,
  location_name text not null,
  stop_type text not null check (stop_type in ('pickup', 'waypoint', 'delivery')),
  planned_at timestamptz,
  actual_at timestamptz,
  status text not null default 'pending',
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now()
);

create index if not exists shipment_stops_shipment_idx on public.shipment_stops (organization_id, shipment_id, sequence);

-- ============================================================================
-- 5. Import Pipeline & Errors
-- ============================================================================

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  dataset_kind text not null,
  status text not null default 'pending' check (status in ('pending', 'validating', 'validated', 'failed', 'completed')),
  row_count integer not null default 0,
  valid_count integer not null default 0,
  error_count integer not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists imports_org_idx on public.imports (organization_id, created_at desc);

create table if not exists public.import_errors (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number integer not null,
  field text,
  message text not null,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists import_errors_import_idx on public.import_errors (import_id);

-- ============================================================================
-- 6. Optimization Runs, Results & AI Explainability
-- ============================================================================

create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shipment_id text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'timed_out')),
  provider text not null default 'nvidia-cuopt',
  input_hash text,
  request_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists opt_runs_org_idx on public.optimization_runs (organization_id, created_at desc);

create table if not exists public.optimization_results (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  rank integer not null default 1,
  carrier text,
  carrier_id uuid references public.carriers(id) on delete set null,
  route_summary text not null,
  estimated_cost numeric not null,
  estimated_duration_min numeric,
  estimated_distance_km numeric,
  route_geometry jsonb,
  metrics jsonb not null default '{}'::jsonb,
  tradeoffs text,
  explanation text,
  status text not null default 'recommended' check (status in ('recommended', 'accepted', 'modified', 'rejected')),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists opt_results_run_idx on public.optimization_results (optimization_run_id, rank);

create table if not exists public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('lane', 'shipment', 'contract', 'optimization')),
  entity_id text not null,
  prompt_version text not null default 'v1.0',
  explanation text not null,
  supporting_factors jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists ai_explanations_entity_idx on public.ai_explanations (organization_id, entity_type, entity_id);

-- ============================================================================
-- 7. Audit Logging & System Notifications
-- ============================================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, status, created_at desc);

-- ============================================================================
-- 8. Row Level Security (RLS) Policies
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.carriers enable row level security;
alter table public.lanes enable row level security;
alter table public.contracts enable row level security;
alter table public.rates enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_stops enable row level security;
alter table public.imports enable row level security;
alter table public.import_errors enable row level security;
alter table public.optimization_runs enable row level security;
alter table public.optimization_results enable row level security;
alter table public.ai_explanations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Organizations
create policy "Users can view organizations they belong to"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "Users can create organizations"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "Admins can update organizations"
  on public.organizations for update
  using (public.is_org_admin(id));

-- Profiles
create policy "Users can view and edit their own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Organization Members
create policy "Members can view membership in their organization"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "Admins can manage organization members"
  on public.organization_members for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Org creators can insert initial organization member"
  on public.organization_members for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.organizations o
      where o.id = organization_members.organization_id
        and o.created_by = auth.uid()
    )
  );

-- Generic Organization-Isolated Read/Write Policies for Core Business Tables
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'locations', 'carriers', 'lanes', 'contracts', 'rates',
    'shipments', 'shipment_stops', 'imports', 'optimization_runs',
    'ai_explanations', 'audit_logs', 'notifications'
  ]) loop
    execute format('
      create policy "Org members can read %1$I"
        on public.%1$I for select
        using (public.is_org_member(organization_id));
      create policy "Org members can insert %1$I"
        on public.%1$I for insert
        with check (public.is_org_member(organization_id));
      create policy "Org members can update %1$I"
        on public.%1$I for update
        using (public.is_org_member(organization_id));
    ', t);
  end loop;
end $$;

-- Import Errors follows Import
create policy "Org members can read import errors"
  on public.import_errors for select
  using (exists (
    select 1 from public.imports i
    where i.id = import_errors.import_id and public.is_org_member(i.organization_id)
  ));

-- Optimization Results follows Optimization Run
create policy "Org members can view optimization results"
  on public.optimization_results for select
  using (exists (
    select 1 from public.optimization_runs r
    where r.id = optimization_results.optimization_run_id and public.is_org_member(r.organization_id)
  ));

create policy "Org members can update optimization results"
  on public.optimization_results for update
  using (exists (
    select 1 from public.optimization_runs r
    where r.id = optimization_results.optimization_run_id and public.is_org_member(r.organization_id)
  ));
