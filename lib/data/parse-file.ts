import ExcelJS from 'exceljs'
import { parseCsv } from './import'

const MAX_ROWS = 5001

export async function parseOperationalFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (name.endsWith('.csv')) return parseCsv(new TextDecoder().decode(bytes))
  if (name.endsWith('.tsv') || name.endsWith('.txt')) return parseCsv(new TextDecoder().decode(bytes).replace(/\t/g, ','))

  if (name.endsWith('.json') || name.endsWith('.jsonl') || name.endsWith('.ndjson')) {
    const text = new TextDecoder().decode(bytes)
    const records: Record<string, unknown>[] = name.endsWith('.json')
      ? (() => { const value = JSON.parse(text); return Array.isArray(value) ? value : [value] })()
      : text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    if (records.length > MAX_ROWS - 1) throw new Error('Maximum 5,000 data rows per import')
    if (!records.length) return []
    const headers = [...new Set(records.flatMap(record => Object.keys(record)))]
    return [headers, ...records.map(record => headers.map(header => {
      const value = record[header]
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    }))]
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const workbook = new ExcelJS.Workbook()
    // ExcelJS 4.x exposes a Node Buffer overload whose generic differs from @types/node 24.
    // Keep the compatibility cast isolated at this third-party library boundary.
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.worksheets[0]
    if (sheet == null) return []
    if (sheet.rowCount > MAX_ROWS) throw new Error('Maximum 5,000 data rows per import')

    const values = sheet.getSheetValues() as unknown[][]
    return values.filter(Boolean).map(row => row.slice(1).map(value => {
      if (value == null) return ''
      if (typeof value === 'object' && 'result' in value) return String((value as { result?: unknown }).result ?? '')
      if (typeof value === 'object' && 'text' in value) return String((value as { text?: unknown }).text ?? '')
      return String(value)
    }))
  }

  throw new Error('This file format is not supported for secure import. Use CSV, TSV, TXT, JSON, JSONL, NDJSON, XLSX or XLSM.')
}
