'use client'

import { useState } from 'react'
import { ArrowUpRight, Bot, Loader2 } from 'lucide-react'

const starters = [
  'Which lanes show the strongest evidence of ghost capacity?',
  'Why should procurement review the highest-risk lanes?',
  'Where is contracted capacity most under-realized?',
]

export function AIInvestigator() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [meta, setMeta] = useState<{ model: string; lanes: number; contracts: number; shipmentsAggregated: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function investigate(nextQuestion = question) {
    const value = nextQuestion.trim()
    if (!value || loading) return
    setQuestion(value)
    setLoading(true)
    setError('')
    setAnswer('')
    setMeta(null)
    try {
      const response = await fetch('/api/ai/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: value }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to investigate the workspace')
      setAnswer(body.answer)
      setMeta({ model: body.model, ...body.evidence })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to investigate the workspace')
    } finally {
      setLoading(false)
    }
  }

  return <section className="mt-6 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
    <div className="border-b border-[#edf0f5] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><Bot size={18} /></span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#1769e0]">Decision assistant</p>
          <h2 className="mt-1 text-lg font-black tracking-[-.02em]">Investigate the network</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#66758a]">Ask why a lane is under-realizing, where procurement exposure is concentrated, or what the connected records support. Answers are grounded in this workspace.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {starters.map(starter => <button key={starter} onClick={() => investigate(starter)} disabled={loading} className="rounded-xl border border-[#dbe2ec] bg-[#fafbfd] px-3 py-2 text-left text-[11px] font-semibold text-[#526174] transition hover:border-[#b9c9dc] hover:bg-white disabled:opacity-50">{starter}</button>)}
      </div>

      <form onSubmit={event => { event.preventDefault(); void investigate() }} className="mt-4 flex gap-2">
        <input value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} placeholder="Ask a procurement question about your network…" className="min-w-0 flex-1 rounded-xl border border-[#cfd9e6] bg-white px-4 py-3 text-xs font-medium text-[#08111f] outline-none placeholder:text-[#9aa5b3] focus:border-[#1769e0]" />
        <button type="submit" disabled={!question.trim() || loading} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#08111f] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} {loading ? 'Investigating' : 'Investigate'}</button>
      </form>
    </div>

    {error && <div className="border-b border-[#f1d7d7] bg-[#fff8f8] px-5 py-3 text-xs font-semibold text-[#a33a3a]">{error}</div>}

    {answer && <div className="p-5 sm:p-6">
      <div className="rounded-2xl border border-[#e1e7ee] bg-[#fafbfd] p-5">
        <div className="mb-3 flex items-center justify-between gap-4"><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#1769e0]">Evidence-backed response</span>{meta && <span className="text-[9px] font-bold text-[#8994a3]">{meta.model}</span>}</div>
        <div className="whitespace-pre-wrap text-sm leading-7 text-[#354255]">{answer}</div>
      </div>
      {meta && <p className="mt-3 text-[10px] font-semibold text-[#8994a3]">Grounded on {meta.lanes} lane records, {meta.contracts} contract records, and {meta.shipmentsAggregated} shipment records aggregated by lane. No external operational source was assumed.</p>}
    </div>}
  </section>
}
