'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, FileUp, ShieldCheck, Trash2, UploadCloud, XCircle } from 'lucide-react'
import Link from 'next/link'
import { parseCsv, validateHeaders, type ImportKind } from '@/lib/data/import'

const ACCEPTED = '.csv,.tsv,.txt,.json,.xlsx,.xlsm,.jsonl,.ndjson'
const TEXT_EXTENSIONS = ['.csv', '.tsv', '.txt', '.json', '.jsonl', '.ndjson']
const KINDS: { id: ImportKind; label: string; description: string; required: string }[] = [
  { id: 'lanes', label: 'Lanes', description: 'Origin, destination and network capacity.', required: 'origin + destination' },
  { id: 'carriers', label: 'Carriers', description: 'Carrier performance and reliability.', required: 'carrier' },
  { id: 'contracts', label: 'Contracts', description: 'Committed capacity, rates and dates.', required: 'contract_id + lane + carrier' },
  { id: 'shipments', label: 'Shipments / Master', description: 'Movement records. Master shipment exports are supported automatically.', required: 'shipment_id + lane + carrier' },
]

type QueueItem = { file: File; kind: ImportKind; rows: number; missing: string[]; optionalMissing: string[]; error?: string }

function inferKind(headers: string[]): ImportKind {
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/^\uFEFF/, '').replace(/\s+/g, '_'))
  if (normalized.includes('contract_id')) return 'contracts'
  if (normalized.includes('shipment_id')) return 'shipments'
  if (normalized.includes('carrier') && !normalized.includes('origin')) return 'carriers'
  if (normalized.includes('origin') && normalized.includes('destination')) return 'lanes'
  return 'shipments'
}

export default function ImportPage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const totalRows = useMemo(() => items.reduce((sum, item) => sum + item.rows, 0), [items])

  async function inspectFile(file: File): Promise<QueueItem> {
    const lower = file.name.toLowerCase()
    if (file.size > 10 * 1024 * 1024) return { file, kind: 'shipments', rows: 0, missing: [], optionalMissing: [], error: 'File exceeds the 10 MB limit.' }
    if (!TEXT_EXTENSIONS.some(ext => lower.endsWith(ext)) && !lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) {
      return { file, kind: 'shipments', rows: 0, missing: [], optionalMissing: [], error: 'Unsupported file type.' }
    }
    if (!TEXT_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      return { file, kind: lower.includes('carrier') ? 'carriers' : lower.includes('contract') ? 'contracts' : lower.includes('lane') ? 'lanes' : 'shipments', rows: 0, missing: [], optionalMissing: [], error: undefined }
    }
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.length < 2) return { file, kind: 'shipments', rows: 0, missing: [], optionalMissing: [], error: 'The file needs a header and at least one data row.' }
      if (parsed.length - 1 > 5000) return { file, kind: inferKind(parsed[0]), rows: 0, missing: [], optionalMissing: [], error: 'Maximum 5,000 data rows per file.' }
      const kind = inferKind(parsed[0])
      const validation = validateHeaders(parsed[0], kind)
      // Optional columns are enrichment only. They must never make a valid import
      // look incomplete; the server derives GhostLane intelligence when absent.
      return { file, kind, rows: parsed.length - 1, missing: validation.missing, optionalMissing: [] }
    } catch {
      return { file, kind: 'shipments', rows: 0, missing: [], optionalMissing: [], error: 'The file could not be read. Check that it is valid CSV/JSON/TSV.' }
    }
  }

  async function addFiles(fileList: FileList | File[]) {
    setError('')
    setResult('')
    const incoming = Array.from(fileList)
    if (!incoming.length) return
    const inspected = await Promise.all(incoming.map(inspectFile))
    setItems(current => [...current, ...inspected].slice(0, 8))
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void addFiles(event.target.files)
    event.target.value = ''
  }

  function updateKind(index: number, kind: ImportKind) {
    setItems(current => current.map((item, i) => i === index ? { ...item, kind, missing: [] } : item))
  }

  async function importAll() {
    setError('')
    setResult('')
    if (!items.length) return setError('Add at least one company data file.')
    const invalid = items.find(item => item.error || item.missing.length)
    if (invalid) return setError(`Fix ${invalid.file.name} before importing.`)
    setLoading(true)
    let imported = 0
    let skipped = 0
    const failures: string[] = []

    for (const item of items) {
      const form = new FormData()
      form.append('kind', item.kind)
      form.append('file', item.file)
      try {
        const response = await fetch('/api/workspace/import-file', { method: 'POST', body: form })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Import failed')
        imported += Number(data.imported || 0)
        skipped += Number(data.skipped || 0)
      } catch (e) {
        failures.push(`${item.file.name}: ${e instanceof Error ? e.message : 'Import failed'}`)
      }
    }

    setLoading(false)
    if (failures.length) {
      setError(failures.join(' | '))
      setResult(`${imported.toLocaleString()} records imported; ${skipped.toLocaleString()} duplicates skipped.`)
      return
    }
    setResult(`${imported.toLocaleString()} records imported successfully${skipped ? ` · ${skipped.toLocaleString()} duplicates skipped` : ''}.`)
    window.location.assign('/?view=overview&imported=1')
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-7 text-[#08111f] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1180px]">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#1769e0]"><ArrowLeft size={14} />Back to overview</Link>
        <div className="mt-5 border-b border-[#dbe2ec] pb-7">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#1769e0]">GhostLane data ingestion</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Upload your company data</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">Upload one master shipment export or multiple operational files. GhostLane detects the dataset type, validates required fields, prevents duplicate records and refreshes the dashboard after import.</p>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_330px]">
          <section className="rounded-3xl border border-[#dbe2ec] bg-white p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#edf4ff] p-4"><Database size={18} className="text-[#1769e0]"/><p className="mt-3 text-xs font-extrabold">1. Add files</p><p className="mt-1 text-[10px] leading-4 text-[#66758a]">CSV, JSON, TSV or Excel up to 10 MB.</p></div>
              <div className="rounded-2xl bg-[#f6f8fb] p-4"><ShieldCheck size={18} className="text-[#1769e0]"/><p className="mt-3 text-xs font-extrabold">2. Validate</p><p className="mt-1 text-[10px] leading-4 text-[#66758a]">Only required identity fields block an import.</p></div>
              <div className="rounded-2xl bg-[#f6f8fb] p-4"><CheckCircle2 size={18} className="text-[#187650]"/><p className="mt-3 text-xs font-extrabold">3. Analyze</p><p className="mt-1 text-[10px] leading-4 text-[#66758a]">GhostLane derives missing intelligence automatically.</p></div>
            </div>

            <label onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files) }} className={`mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center transition ${dragging ? 'border-[#1769e0] bg-[#edf4ff]' : 'border-[#bfcbd9] bg-[#fafbfd] hover:border-[#1769e0]'}`}>
              <UploadCloud size={30} className="text-[#1769e0]" />
              <span className="mt-4 text-sm font-extrabold">Drop company files here</span>
              <span className="mt-1 text-xs text-[#8490a0]">or click to browse · up to 8 files · 10 MB each</span>
              <span className="mt-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#66758a] shadow-sm">Master shipment CSV works here too</span>
              <input type="file" multiple accept={ACCEPTED} className="hidden" onChange={onFile} />
            </label>

            {items.length > 0 && <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Import queue</h2><p className="mt-1 text-[10px] text-[#8994a3]">{items.length} file{items.length === 1 ? '' : 's'} · {totalRows.toLocaleString()} visible rows</p></div><button type="button" onClick={() => setItems([])} className="text-[10px] font-bold text-[#b54747]">Clear all</button></div>
              {items.map((item, index) => <div key={`${item.file.name}-${index}`} className="rounded-2xl border border-[#e1e7ef] p-4">
                <div className="flex items-start gap-3"><FileUp size={18} className="mt-0.5 shrink-0 text-[#1769e0]"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{item.file.name}</p><p className="mt-1 text-[10px] text-[#8994a3]">{(item.file.size / 1024).toFixed(1)} KB {item.rows ? `· ${item.rows.toLocaleString()} rows` : '· server preview'}</p></div><button type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))} className="text-[#9aa4b1] hover:text-[#b54747]"><Trash2 size={15}/></button></div>
                <div className="mt-3 flex flex-wrap items-center gap-2"><select value={item.kind} onChange={e => updateKind(index, e.target.value as ImportKind)} className="rounded-lg border border-[#dbe2ec] bg-white px-3 py-2 text-[10px] font-bold outline-none"><option value="lanes">Lanes</option><option value="carriers">Carriers</option><option value="contracts">Contracts</option><option value="shipments">Shipments / Master</option></select><span className="rounded-lg bg-[#f6f8fb] px-3 py-2 text-[10px] font-bold text-[#66758a]">Detected from headers</span></div>
                {item.error && <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-[10px] font-semibold text-red-700"><XCircle size={14} className="shrink-0"/>{item.error}</div>}
                {!item.error && item.missing.length > 0 && <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-[10px] font-semibold text-amber-800"><AlertTriangle size={14} className="shrink-0"/>Missing required fields: {item.missing.join(', ')}</div>}
                {!item.error && !item.missing.length && <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-[10px] font-semibold text-green-700"><CheckCircle2 size={14} className="shrink-0"/>Ready to import · {item.rows.toLocaleString()} {item.kind === 'shipments' ? 'shipments' : item.kind} detected. Optional enrichment fields can be added later; GhostLane will derive missing intelligence automatically.</div>}
              </div>)}
            </div>}

            {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">{error}</div>}
            {result && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-700">{result}</div>}

            <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-[#f6f8fb] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-[10px] text-[#66758a]"><ShieldCheck size={15}/> Server-side authorization, validation and duplicate protection.</div><button type="button" onClick={importAll} disabled={loading || !items.length} className="rounded-xl bg-[#1769e0] px-5 py-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Importing company data…' : `Import ${items.length ? `${items.length} file${items.length === 1 ? '' : 's'}` : 'data'}`}</button></div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-[#dbe2ec] bg-white p-6"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8490a0]">What GhostLane needs</p><div className="mt-4 space-y-4">{KINDS.map(item => <div key={item.id}><p className="text-xs font-extrabold">{item.label}</p><p className="mt-1 text-[10px] leading-4 text-[#788596]">{item.description}</p><p className="mt-1 text-[9px] font-bold text-[#1769e0]">Required: {item.required}</p></div>)}</div></div>
            <div className="rounded-3xl bg-[#08111f] p-6 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#83b4ff]">After import</p><p className="mt-4 text-lg font-black">Your data becomes the dashboard.</p><p className="mt-2 text-[11px] leading-5 text-[#aab5c3]">Lanes, shipments, contracts and carriers are linked to your workspace. GhostLane derives shipment-level ghost-lane signals from the operational variance available in the file.</p></div>
          </aside>
        </div>
      </div>
    </main>
  )
}
