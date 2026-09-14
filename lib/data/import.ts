export type ImportKind = 'lanes' | 'contracts' | 'shipments' | 'carriers'

// Minimum identity fields block an import. Everything else is optional and can be
// enriched by GhostLane after the data is loaded.
export const REQUIRED_COLUMNS: Record<ImportKind, string[]> = {
  lanes: ['origin', 'destination'],
  contracts: ['contract_id', 'origin', 'destination', 'carrier'],
  shipments: ['shipment_id', 'origin', 'destination', 'carrier'],
  carriers: ['carrier'],
}

export const OPTIONAL_COLUMNS: Record<ImportKind, string[]> = {
  lanes: ['mode', 'distance_km', 'contracted_volume', 'materialized_volume', 'carrier', 'risk_score'],
  contracts: ['contracted_volume', 'contract_rate', 'start_date', 'end_date'],
  shipments: [
    'shipment_date', 'volume', 'status', 'expected_cost', 'actual_cost',
    'expected_transit_hours', 'actual_transit_hours', 'eta_date', 'delivered_at',
    'exception_type', 'risk_score', 'notes',
    'ghost_lane_score', 'ghost_lane_status', 'ghost_lane_reason', 'ghost_lane_confidence',
    'lane_id', 'distance_km', 'mode',
    'carrier_acceptance_rate', 'carrier_rejection_rate', 'carrier_cancellation_rate',
    'carrier_realization_rate',
  ],
  carriers: ['acceptance_rate', 'rejection_rate', 'cancellation_rate', 'realization_rate'],
}

const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_')

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue }
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }

  if (cell || row.length) {
    row.push(cell.trim())
    if (row.some(Boolean)) rows.push(row)
  }
  return rows
}

export function validateHeaders(headers: string[], kind: ImportKind) {
  const normalized = headers.map(normalizeHeader)
  const required = REQUIRED_COLUMNS[kind]
  const optional = OPTIONAL_COLUMNS[kind]
  return {
    missing: required.filter(col => !normalized.includes(col)),
    optionalMissing: optional.filter(col => !normalized.includes(col)),
    normalized,
  }
}
