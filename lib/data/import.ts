export type ImportKind = 'lanes' | 'contracts' | 'shipments' | 'carriers'

// Only identity / minimum operational fields block an import.
// Analytics fields are optional so partial company exports can still be used.
export const REQUIRED_COLUMNS: Record<ImportKind, string[]> = {
  lanes: ['origin', 'destination'],
  contracts: ['contract_id', 'origin', 'destination', 'carrier'],
  shipments: ['shipment_id', 'origin', 'destination', 'carrier'],
  carriers: ['carrier'],
}

export const OPTIONAL_COLUMNS: Record<ImportKind, string[]> = {
  lanes: ['mode', 'distance_km', 'contracted_volume', 'materialized_volume', 'carrier', 'risk_score'],
  contracts: ['contracted_volume', 'contract_rate', 'start_date', 'end_date'],
  shipments: ['shipment_date', 'volume', 'status'],
  carriers: ['acceptance_rate', 'rejection_rate', 'cancellation_rate', 'realization_rate'],
}

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
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
      continue
    }
    cell += ch
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row) }
  return rows
}

export function validateHeaders(headers: string[], kind: ImportKind) {
  const normalized = headers.map(h => h.trim().toLowerCase())
  const required = REQUIRED_COLUMNS[kind]
  const optional = OPTIONAL_COLUMNS[kind]
  return {
    missing: required.filter(col => !normalized.includes(col)),
    optionalMissing: optional.filter(col => !normalized.includes(col)),
    normalized,
  }
}
