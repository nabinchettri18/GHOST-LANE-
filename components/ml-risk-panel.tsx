'use client'

import { useState } from 'react'

type Prediction = {
  contractId: string
  lane: string
  carrier: string
  risk: number
  probability: number
  band: 'low' | 'watch' | 'high'
  confidence: number
  historicalMaterialized: number
  historicalLabel: number | null
}

type RunResult = {
  model: string
  version: string
  trainingSamples: number
  holdoutSamples: number
  features: string[]
  evaluation: { accuracy: number | null; precision: number | null; recall: number | null; samples: number }
  predictions: Prediction[]
  note: string
}

const pct = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(0)}%`

export function MLRiskPanel() {
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runModel() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/ml/run', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to run the model')
      setResult(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the model')
    } finally {
      setLoading(false)
    }
  }

  return <section className="mt-6 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
    <div className="flex flex-col gap-4 border-b border-[#edf0f5] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#1769e0]">Supervised model</p>
        <h2 className="mt-1 text-lg font-black tracking-[-.02em]">Ghost risk engine</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[#66758a]">Train on completed contract outcomes in this workspace, validate on the latest time-ordered records, then score contracts without writing synthetic data.</p>
      </div>
      <button onClick={runModel} disabled={loading} className="shrink-0 rounded-xl bg-[#08111f] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? 'Running model…' : result ? 'Run again' : 'Run GhostLane ML'}
      </button>
    </div>

    {error && <div className="border-b border-[#f1d7d7] bg-[#fff8f8] px-5 py-3 text-xs font-semibold text-[#a33a3a]">{error}</div>}

    {!result && !error && <div className="px-5 py-8 text-xs text-[#66758a]">The model runs only against authenticated workspace data. At least 12 completed contract outcomes with both classes are required.</div>}

    {result && <>
      <div className="grid grid-cols-2 border-b border-[#edf0f5] md:grid-cols-5">
        <Metric label="Training" value={String(result.trainingSamples)} />
        <Metric label="Holdout" value={String(result.holdoutSamples)} />
        <Metric label="Accuracy" value={pct(result.evaluation.accuracy)} />
        <Metric label="Precision" value={pct(result.evaluation.precision)} />
        <Metric label="Recall" value={pct(result.evaluation.recall)} />
      </div>
      <div className="border-b border-[#edf0f5] bg-[#fafbfd] px-5 py-3 text-[11px] text-[#66758a]">{result.model} · v{result.version} · {result.note}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-[#fafbfd] text-[10px] uppercase tracking-[.12em] text-[#8490a0]"><tr><th className="px-5 py-3">Contract</th><th className="px-5 py-3">Lane</th><th className="px-5 py-3">Carrier</th><th className="px-5 py-3">Risk</th><th className="px-5 py-3">Band</th><th className="px-5 py-3">Confidence</th></tr></thead>
          <tbody>{result.predictions.slice(0, 50).sort((a,b) => b.risk - a.risk).map(p => <tr key={`${p.contractId}-${p.lane}`} className="border-t border-[#edf0f5]">
            <td className="px-5 py-4 font-bold">{p.contractId}</td><td className="px-5 py-4 font-semibold">{p.lane}</td><td className="px-5 py-4">{p.carrier}</td>
            <td className="px-5 py-4 font-black">{p.risk}</td><td className="px-5 py-4 capitalize">{p.band}</td><td className="px-5 py-4 text-[#66758a]">{(p.confidence * 100).toFixed(0)}%</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="p-4 sm:p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8490a0]">{label}</div><div className="mt-1.5 text-xl font-black tracking-[-.03em]">{value}</div></div>
}
