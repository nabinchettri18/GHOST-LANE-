alter table public.shipments
  add column if not exists live_lat numeric,
  add column if not exists live_lng numeric,
  add column if not exists current_eta timestamptz,
  add column if not exists current_route text,
  add column if not exists last_event_at timestamptz,
  add column if not exists help_status text default 'none',
  add column if not exists vehicle_capacity numeric,
  add column if not exists vehicle_id text,
  add column if not exists priority text,
  add column if not exists time_window_start timestamptz,
  add column if not exists time_window_end timestamptz;

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  shipment_id text not null, event_type text not null, severity text not null default 'info', message text,
  latitude numeric, longitude numeric, eta_before timestamptz, eta_after timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists shipment_events_org_shipment_idx on public.shipment_events (organization_id, shipment_id, created_at desc);

create table if not exists public.shipment_help_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  shipment_id text not null, status text not null default 'open', reason text, latitude numeric, longitude numeric,
  relief_shipment_id text, created_at timestamptz not null default now(), resolved_at timestamptz
);
create index if not exists shipment_help_org_status_idx on public.shipment_help_requests (organization_id, status, created_at desc);

create or replace function public.set_shipment_operation_org() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.organization_id is null then select s.organization_id into new.organization_id from public.shipments s where s.shipment_id=new.shipment_id limit 1; end if;
  return new;
end; $$;

drop trigger if exists shipment_events_set_org on public.shipment_events;
create trigger shipment_events_set_org before insert on public.shipment_events for each row execute function public.set_shipment_operation_org();
drop trigger if exists shipment_help_set_org on public.shipment_help_requests;
create trigger shipment_help_set_org before insert on public.shipment_help_requests for each row execute function public.set_shipment_operation_org();

alter table public.shipment_events enable row level security;
alter table public.shipment_help_requests enable row level security;

create policy "shipment events follow shipment organization" on public.shipment_events
for all using (exists (select 1 from public.shipments s where s.shipment_id=shipment_events.shipment_id and s.organization_id=shipment_events.organization_id))
with check (exists (select 1 from public.shipments s where s.shipment_id=shipment_events.shipment_id and s.organization_id=shipment_events.organization_id));
create policy "shipment help follows shipment organization" on public.shipment_help_requests
for all using (exists (select 1 from public.shipments s where s.shipment_id=shipment_help_requests.shipment_id and s.organization_id=shipment_help_requests.organization_id))
with check (exists (select 1 from public.shipments s where s.shipment_id=shipment_help_requests.shipment_id and s.organization_id=shipment_help_requests.organization_id));
