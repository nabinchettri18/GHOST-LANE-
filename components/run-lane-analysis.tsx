'use client'

import { useState } from 'react'
import { BrainCircuit, CheckCircle2, Loader2 } from 'lucide-react'

export function RunLaneAnalysis(){
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState('')
  async function run(){
    setLoading(true); setMessage('')
    try{const r=await fetch('/api/intelligence/lanes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}});const body=await r.json().catch(()=>({})) as {error?:string;laneCount?:number};if(!r.ok)throw new Error(body.error||'Analysis failed');setMessage(`${body.laneCount??0} lanes analyzed`);window.location.reload()}catch(e){setMessage(e instanceof Error?e.message:'Analysis failed')}finally{setLoading(false)}}
  return <div className="flex items-center gap-3"><button onClick={run} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd6e5] bg-white px-4 text-xs font-bold text-[#16304f] shadow-sm hover:border-[#1769e0] hover:text-[#1769e0] disabled:cursor-not-allowed disabled:opacity-60">{loading?<Loader2 size={15} className="animate-spin"/>:<BrainCircuit size={15}/>} {loading?'Analyzing…':'Run lane intelligence'}</button>{message&&<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#526174]"><CheckCircle2 size={14} className="text-[#1769e0]"/>{message}</span>}</div>
}
