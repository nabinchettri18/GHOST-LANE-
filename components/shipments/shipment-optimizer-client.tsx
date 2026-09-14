'use client'

import { useState } from 'react'
import { BrainCircuit, CheckCircle2, ChevronRight, Clock3, Fuel, Loader2, Navigation, Route, ShieldAlert, Sparkles, Truck, XCircle } from 'lucide-react'
import Link from 'next/link'
import type { OptimizationAlternative, OptimizationResponse } from '@/lib/integrations/optimizationAdapter'

type Props = {
  shipmentId: string
  origin: string
  destination: string
  carrier: string
  currentRoute?: string | null
  currentCost?: number | null
}

export function ShipmentOptimizerClient({
  shipmentId,
  origin,
  destination,
  carrier,
  currentRoute,
  currentCost,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OptimizationResponse | null>(null)
  const [selectedRank, setSelectedRank] = useState<number>(1)
  const [decisionState, setDecisionState] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [notice, setNotice] = useState<string>('')

  const handleOptimize = async () => {
    setLoading(true)
    setNotice('')
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/optimize`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Optimization failed')
      setResult(data)
      setSelectedRank(1)
      setNotice('Dynamic routing evaluated successfully with NVIDIA cuOpt.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Optimization failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (alt: OptimizationAlternative) => {
    try {
      const res = await fetch(`/api/workspace/shipments/${encodeURIComponent(shipmentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'dispatched',
          current_route: alt.routeSummary,
          actual_cost: alt.estimatedCost,
          actual_transit_hours: Number((alt.estimatedDurationMin / 60).toFixed(1)),
          notes: `Accepted recommendation #${alt.rank} (${alt.carrier}): ${alt.tradeoffs}`,
        }),
      })
      if (!res.ok) throw new Error('Failed to update shipment status')
      setDecisionState('accepted')
      setNotice(`Recommendation accepted! Carrier ${alt.carrier} committed to shipment.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleReject = () => {
    setDecisionState('rejected')
    setNotice('Recommendation rejected. Operational default preserved.')
  }

  return (
    <section className="rounded-3xl border border-[#dbe2ec] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#2563eb]">
            <BrainCircuit size={15} /> Dynamic Routing Engine (cuOpt)
          </div>
          <h2 className="mt-2 text-xl font-black text-[#0f172a]">
            Dynamic Route & Capacity Optimization
          </h2>
          <p className="mt-1 text-xs text-[#64748b]">
            Evaluate road conditions, vehicle capacity, and carrier availability to generate ranked route/cost options.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOptimize}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1e293b] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Optimizing with cuOpt…' : 'Run cuOpt Optimization'}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`mt-4 rounded-xl p-3 text-xs font-bold ${notice.includes('accepted') || notice.includes('successfully') ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
          {notice}
        </div>
      )}

      {result ? (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
            <div className="text-xs font-extrabold text-[#0f172a]">
              Ranked Alternatives ({result.alternatives.length} Generated)
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
              Provider: {result.provider}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {result.alternatives.map((alt) => {
              const isSelected = selectedRank === alt.rank
              return (
                <div
                  key={alt.rank}
                  onClick={() => setSelectedRank(alt.rank)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-[#2563eb] bg-blue-50/40 ring-2 ring-[#2563eb]/20'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-[#0f172a] px-2 py-0.5 text-[9px] font-black text-white">
                      Rank #{alt.rank} {alt.rank === 1 ? '· Best Option' : ''}
                    </span>
                    <span className="text-xs font-black text-[#0f172a]">
                      ₹{alt.estimatedCost.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="mt-3 text-xs font-extrabold text-[#0f172a]">
                    {alt.carrier}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748b]">
                    {alt.routeSummary}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e2e8f0] pt-2 text-[10px]">
                    <div>
                      <span className="text-[#94a3b8]">Transit:</span>{' '}
                      <strong className="text-[#0f172a]">{Math.round(alt.estimatedDurationMin / 60)}h</strong>
                    </div>
                    <div>
                      <span className="text-[#94a3b8]">Fill Rate:</span>{' '}
                      <strong className="text-[#0f172a]">{alt.utilizationPct}%</strong>
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-[#64748b]">
                    {alt.tradeoffs}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Selected Alternative Details & Explainability */}
          {(() => {
            const selectedAlt = result.alternatives.find((a) => a.rank === selectedRank) || result.recommended
            return (
              <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#64748b]">
                      Recommendation Details & Explainability
                    </span>
                    <h3 className="mt-1 text-sm font-extrabold text-[#0f172a]">
                      {selectedAlt.carrier} — {selectedAlt.routeSummary}
                    </h3>
                    <p className="mt-1 text-xs text-[#526174]">{selectedAlt.explanation}</p>
                  </div>

                  {decisionState === 'accepted' ? (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 size={16} /> Dispatched & Committed
                    </div>
                  ) : decisionState === 'rejected' ? (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-xs font-bold text-red-800">
                      <XCircle size={16} /> Decision Rejected
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-bold text-[#64748b] hover:bg-red-50 hover:text-red-700"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAccept(selectedAlt)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2 text-xs font-bold text-white hover:bg-[#1d4ed8]"
                      >
                        <CheckCircle2 size={14} /> Accept & Dispatch
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-[#e2e8f0] pt-3 text-[10px] text-[#64748b]">
                  <strong>Key Assumptions:</strong> {selectedAlt.assumptions.join(' · ')}
                </div>
              </div>
            )
          })()}

          <div className="flex justify-end pt-2">
            <Link
              href="/navigation"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563eb] hover:underline"
            >
              <Navigation size={14} /> Handoff to Live Driver Navigation <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-6 text-center">
          <Route className="mx-auto text-[#94a3b8]" size={28} />
          <h4 className="mt-2 text-xs font-extrabold text-[#0f172a]">
            Dynamic Routing Ready
          </h4>
          <p className="mt-1 text-[11px] text-[#64748b]">
            Click the optimization button to evaluate feasible carrier schedules, waypoint sequence, and cuOpt cost trade-offs.
          </p>
        </div>
      )}
    </section>
  )
}
