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
    await workbook.xlsx.load(bytes)
    const sheet = workbook.worksheets[0]
    if (!sheet) return []
    if (sheet.rowCount > MAX_ROWS) throw new Error('Maximum 5,000 data rows per import')
    const rows: string[][] = []
    sheet.eachRow({ includeEmpty: true }, row => {
      rows.push(row.values.slice(1).map(value => {
        if (value == null) return ''
        if (typeof value === 'object' && 'result' in value) return String(value.result ?? '')
        if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
        return String(value)
      }))
    })
    return rows
  }

  throw new Error('This file format is not supported for secure import. Use CSV, TSV, TXT, JSON, JSONL, NDJSON, XLSX or XLSM.')
}
