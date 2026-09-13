export type ImportKind = 'lanes' | 'contracts' | 'shipments' | 'carriers'

export const REQUIRED_COLUMNS: Record<ImportKind, string[]> = {
  lanes: ['origin', 'destination', 'mode', 'contracted_volume', 'materialized_volume'],
  contracts: ['contract_id', 'origin', 'destination', 'carrier', 'contracted_volume', 'contract_rate', 'start_date', 'end_date'],
  shipments: ['shipment_id', 'origin', 'destination', 'carrier', 'shipment_date', 'volume', 'status'],
  carriers: ['carrier', 'acceptance_rate', 'rejection_rate', 'cancellation_rate'],
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
  return { missing: required.filter(col => !normalized.includes(col)), normalized }
}
