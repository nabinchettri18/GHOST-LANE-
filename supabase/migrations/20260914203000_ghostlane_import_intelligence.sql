alter table public.shipments
  add column if not exists ghost_lane_score numeric,
  add column if not exists ghost_lane_status text,
  add column if not exists ghost_lane_reason text,
  add column if not exists ghost_lane_confidence numeric;

create index if not exists shipments_org_ghost_lane_idx
  on public.shipments (organization_id, ghost_lane_status, ghost_lane_score desc);
