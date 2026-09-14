alter table public.shipments
  add column if not exists expected_cost numeric,
  add column if not exists actual_cost numeric,
  add column if not exists expected_transit_hours numeric,
  add column if not exists actual_transit_hours numeric,
  add column if not exists eta_date date,
  add column if not exists delivered_at timestamptz,
  add column if not exists exception_type text,
  add column if not exists risk_score numeric,
  add column if not exists notes text;

create index if not exists shipments_org_status_idx on public.shipments (organization_id, status);
create index if not exists shipments_org_lane_date_idx on public.shipments (organization_id, lane_id, shipment_date desc);
