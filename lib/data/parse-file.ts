import * as XLSX from 'xlsx'
import { parseCsv } from './import'

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
    if (!records.length) return []
    const headers = [...new Set(records.flatMap(record => Object.keys(record)))]
    return [headers, ...records.map(record => headers.map(header => {
      const value = record[header]
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    }))]
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.ods')) {
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return []
    return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' }) as string[][]
  }

  throw new Error('This file format is not yet supported for structured import. Use CSV, TSV, TXT, JSON, JSONL, NDJSON, Excel, or ODS.')
}
