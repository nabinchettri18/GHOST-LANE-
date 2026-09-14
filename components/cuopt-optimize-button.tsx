'use client'

import { useState } from 'react'
import { BrainCircuit, Loader2 } from 'lucide-react'

export function CuOptOptimizeButton({ distanceKm, durationMin }: { distanceKm: number; durationMin: number }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const optimize = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/maps/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distanceKm, durationMin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Optimization unavailable')
      setMessage(data.provider === 'nvidia-cuopt' ? 'NVIDIA cuOpt optimization completed.' : 'Optimization completed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Optimization unavailable')
    } finally {
      setLoading(false)
    }
  }

  return <div className="flex flex-col items-end gap-1.5">
    <button onClick={optimize} disabled={loading || !distanceKm} className="inline-flex items-center gap-2 rounded-xl bg-[#08111f] px-3 py-2 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
      {loading ? <Loader2 size={12} className="animate-spin"/> : <BrainCircuit size={12}/>} Optimize with NVIDIA
    </button>
    {message && <span className="max-w-xs text-right text-[8px] font-bold text-[#66758a]">{message}</span>}
  </div>
}
