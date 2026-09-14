import { getProviderStatuses } from '@/app/lib/data-providers'
import { CheckCircle2, Cloud, LockKeyhole, Radio, ShieldCheck } from 'lucide-react'

const iconFor = (id: string) => {
  if (id === 'open-meteo') return Cloud
  if (id === 'ulip') return ShieldCheck
  if (id === 'gst-eway') return LockKeyhole
  return Radio
}

const statusCopy = {
  ready: 'Available',
  needs_credentials: 'Authorization needed',
  not_configured: 'Optional setup',
} as const

export function ProviderStatus() {
  const providers = getProviderStatuses()

  return (
    <section className="mt-5 rounded-2xl border border-[#dbe2ec] bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8490a0]">External context</p>
          <h2 className="mt-1 text-base font-black">Public & authorized data sources</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#66758a]">GhostLane keeps company operational data separate from external signals. Public sources enrich analysis; government feeds are only used after your organization has its own authorization.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#4d7a61]"><CheckCircle2 size={14}/> Secrets stay server-side</div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => {
          const Icon = iconFor(provider.id)
          return (
            <article key={provider.id} className="rounded-xl border border-[#edf0f5] bg-[#fbfcfe] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf4ff] text-[#1769e0]"><Icon size={15}/></div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] ${provider.status === 'ready' ? 'bg-[#edf7f0] text-[#4d7a61]' : provider.status === 'needs_credentials' ? 'bg-[#fff6e5] text-[#946b24]' : 'bg-[#f0f2f5] text-[#66758a]'}`}>{statusCopy[provider.status]}</span>
              </div>
              <h3 className="mt-4 text-xs font-extrabold">{provider.name}</h3>
              <p className="mt-1 text-[11px] leading-5 text-[#66758a]">{provider.description}</p>
              <p className="mt-3 text-[10px] leading-4 text-[#8490a0]">{provider.note}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
