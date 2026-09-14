'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, Check, Download, Filter, Search, X } from 'lucide-react'

export type TableRowItem = {
  id: string
  cells: string[]
  raw: Record<string, unknown>
}

type Props = {
  columns: string[]
  rows: TableRowItem[]
  resource: string
}

export function DataTableClient({ columns, rows, resource }: Props) {
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'high_risk' | 'low_realization' | 'exceptions'>('all')

  const filtered = useMemo(() => {
    let list = rows

    // Filter mode logic
    if (filterMode === 'high_risk') {
      list = list.filter(r => {
        const risk = Number(r.raw.risk_score ?? 0)
        return risk >= 70
      })
    } else if (filterMode === 'low_realization') {
      list = list.filter(r => {
        const contracted = Number(r.raw.contracted_volume ?? 0)
        const materialized = Number(r.raw.materialized_volume ?? 0)
        if (contracted > 0) return (materialized / contracted) * 100 < 65
        const real = Number(r.raw.realization_rate ?? 100)
        return real < 65
      })
    } else if (filterMode === 'exceptions') {
      list = list.filter(r => {
        const exc = String(r.raw.exception_type ?? '').trim()
        const status = String(r.raw.status ?? '').toLowerCase()
        return Boolean(exc && exc !== '—') || /delayed|failed|exception|risk/i.test(status)
      })
    }

    // Search query logic
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(r => r.cells.some(c => c.toLowerCase().includes(q)))
    }

    return list
  }, [rows, search, filterMode])

  function exportCsv() {
    if (!filtered.length) return
    const headerLine = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',')
    const dataLines = filtered.map(r => r.cells.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    const csvContent = [headerLine, ...dataLines].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${resource}-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-[#dbe2ec] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#edf0f5] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-extrabold">Operational records</div>
          <div className="mt-1 text-[11px] text-[#8994a3]">
            Showing {filtered.length} of {rows.length} connected records
            {filterMode !== 'all' && <span className="ml-2 font-bold text-[#1769e0]">· Filter: {filterMode.replace('_', ' ')}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showSearch ? (
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-[#8994a3]" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type to filter rows…"
                className="h-9 w-48 rounded-lg border border-[#1769e0] bg-white pl-8 pr-7 text-xs outline-none focus:w-60 transition-all"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear search query"
                  title="Clear search query"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-[#8994a3] hover:text-[#08111f]"
                >
                  <X size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Close search input"
                  title="Close search input"
                  onClick={() => setShowSearch(false)}
                  className="absolute right-2 text-[#8994a3] hover:text-[#08111f]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setShowSearch(true)
                setShowFilter(false)
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dbe2ec] bg-white px-3 text-[11px] font-bold text-[#526174] hover:border-[#b9c9dc] hover:text-[#08111f]"
            >
              <Search size={13} /> {search ? `Search: "${search}"` : 'Search'}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-bold transition ${
                filterMode !== 'all'
                  ? 'border-[#1769e0] bg-[#edf4ff] text-[#1769e0]'
                  : 'border-[#dbe2ec] bg-white text-[#526174] hover:border-[#b9c9dc] hover:text-[#08111f]'
              }`}
            >
              <Filter size={13} /> Filter
            </button>

            {showFilter && (
              <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-[#dbe2ec] bg-white p-2 shadow-xl">
                <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#8994a3]">Filter by attribute</div>
                <button
                  onClick={() => { setFilterMode('all'); setShowFilter(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-[#f6f8fb]"
                >
                  <span>All records</span>
                  {filterMode === 'all' && <Check size={13} className="text-[#1769e0]" />}
                </button>
                <button
                  onClick={() => { setFilterMode('high_risk'); setShowFilter(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-[#f6f8fb]"
                >
                  <span className="text-red-600">High risk (≥ 70)</span>
                  {filterMode === 'high_risk' && <Check size={13} className="text-[#1769e0]" />}
                </button>
                <button
                  onClick={() => { setFilterMode('low_realization'); setShowFilter(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-[#f6f8fb]"
                >
                  <span>Low realization (&lt; 65%)</span>
                  {filterMode === 'low_realization' && <Check size={13} className="text-[#1769e0]" />}
                </button>
                <button
                  onClick={() => { setFilterMode('exceptions'); setShowFilter(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-bold hover:bg-[#f6f8fb]"
                >
                  <span className="text-amber-700">Exceptions / Delays</span>
                  {filterMode === 'exceptions' && <Check size={13} className="text-[#1769e0]" />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dbe2ec] bg-white px-3 text-[11px] font-bold text-[#526174] hover:border-[#1769e0] hover:text-[#1769e0] disabled:cursor-not-allowed disabled:opacity-40"
            title="Download visible table rows as CSV"
          >
            <ArrowDownToLine size={13} /> Export CSV
          </button>

          {(search || filterMode !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterMode('all') }}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-[#b54747] hover:bg-red-50"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {filtered.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[#fafbfd] text-[10px] uppercase tracking-[.12em] text-[#8490a0]">
              <tr>
                {columns.map(c => (
                  <th key={c} className="px-5 py-3.5 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-t border-[#edf0f5] hover:bg-[#f8fbff]">
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-5 py-4 font-semibold text-[#5e6d80]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-16 text-center">
          <div className="text-sm font-extrabold text-[#08111f]">No matching records found</div>
          <p className="mt-1 text-xs text-[#8994a3]">
            {search || filterMode !== 'all' ? 'Try adjusting your search keyword or active filters.' : 'No records exist in this table.'}
          </p>
          {(search || filterMode !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterMode('all') }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#dbe2ec] bg-white px-3 py-2 text-xs font-bold text-[#1769e0]"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  )
}
