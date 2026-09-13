export type LaneRecord = {
  id: string
  origin: string
  destination: string
  mode: string
  contracted_volume: number | null
  materialized_volume: number | null
  carrier: string | null
  risk_score: number | null
}

export function laneMetrics(lane: LaneRecord) {
  const contracted = Math.max(0, Number(lane.contracted_volume ?? 0))
  const materialized = Math.max(0, Number(lane.materialized_volume ?? 0))
  const realization = contracted > 0 ? Math.min(100, (materialized / contracted) * 100) : 0
  const ghost = Math.max(contracted - materialized, 0)
  const risk = lane.risk_score == null ? Math.min(100, Math.max(0, (100 - realization) * 0.7)) : Math.min(100, Math.max(0, Number(lane.risk_score)))
  return { contracted, materialized, ghost, realization, risk }
}

export function summarizeLanes(lanes: LaneRecord[]) {
  const metrics = lanes.map(lane => ({ lane, ...laneMetrics(lane) }))
  const contracted = metrics.reduce((s, x) => s + x.contracted, 0)
  const materialized = metrics.reduce((s, x) => s + x.materialized, 0)
  const ghost = Math.max(contracted - materialized, 0)
  return {
    lanes: metrics,
    laneCount: lanes.length,
    contracted,
    materialized,
    ghost,
    realization: contracted ? (materialized / contracted) * 100 : 0,
    ghostRate: contracted ? (ghost / contracted) * 100 : 0,
    highRisk: metrics.filter(x => x.risk >= 70).length,
  }
}
