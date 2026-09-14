'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(''); setMessage('')
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email') || '').trim()
    const password = String(f.get('password') || '')
    const fullName = String(f.get('full_name') || '').trim()
    const companyName = String(f.get('company_name') || '').trim()
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); setLoading(false); return }
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, company_name: companyName }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session) {
      const bootstrap = await fetch('/api/workspace/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' })
      const body = await bootstrap.json().catch(() => ({})) as { error?: string }
      if (!bootstrap.ok) { await supabase.auth.signOut(); setError(body.error || 'We could not initialize your GhostLane workspace. Please try again.'); setLoading(false); return }
      window.location.assign('/')
      return
    }
    setMessage('Check your email to verify your account. After verification, your private workspace will be created automatically.')
    setLoading(false)
  }

  return <main className="min-h-screen bg-[#f7f9fc] text-[#08111f]"><div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_.95fr]"><section className="hidden border-r border-[#dbe2ec] bg-white px-12 py-12 lg:flex lg:flex-col lg:justify-between"><div><Link href="/login" className="flex items-center gap-3 w-fit"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div><span className="text-lg font-extrabold tracking-tight">GhostLane</span></Link><div className="mt-24 max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#1769e0]">Procurement intelligence</p><h1 className="mt-5 text-5xl font-extrabold tracking-[-0.04em] leading-[1.05]">Build a clearer view of your capacity.</h1><p className="mt-6 text-lg leading-8 text-[#526174]">Bring contracts and shipment activity into one secure workspace for lane-level operational visibility.</p></div></div><div className="flex items-center gap-2 border-t border-[#dbe2ec] pt-6 text-sm text-[#66758a]"><ShieldCheck size={16} className="text-[#1769e0]"/> Organization-level access controls</div></section><section className="flex items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><Link href="/login" className="flex items-center gap-3 w-fit"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div><span className="text-lg font-extrabold">GhostLane</span></Link></div><div className="rounded-2xl border border-[#dbe2ec] bg-white p-7 shadow-[0_12px_40px_rgba(8,17,31,0.05)] sm:p-9"><div className="mb-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><Building2 size={20}/></div><h2 className="text-2xl font-extrabold tracking-tight">Create your workspace</h2><p className="mt-2 text-sm leading-6 text-[#66758a]">Set up your organization's secure GhostLane account.</p></div><form onSubmit={submit} className="space-y-4"><div><label className="mb-2 block text-sm font-bold" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required autoComplete="name" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="Your name"/></div><div><label className="mb-2 block text-sm font-bold" htmlFor="company_name">Company</label><input id="company_name" name="company_name" required autoComplete="organization" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="Company name"/></div><div><label className="mb-2 block text-sm font-bold" htmlFor="email">Work email</label><input id="email" name="email" type="email" required autoComplete="email" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="name@company.com"/></div><div><label className="mb-2 block text-sm font-bold" htmlFor="password">Password</label><div className="relative"><input id="password" name="password" type={showPassword ? 'text' : 'password'} required minLength={10} autoComplete="new-password" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 pr-12 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="At least 10 characters"/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#66758a] hover:bg-[#f0f5fc]">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>{error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="rounded-xl border border-[#b9d3ff] bg-[#edf4ff] px-4 py-3 text-sm text-[#164f9f]">{message}</p>}<button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] text-sm font-bold text-white hover:bg-[#0f57bd] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating workspace…' : 'Create account'}<ArrowRight size={17}/></button></form><div className="mt-6 flex items-center justify-center gap-2 border-t border-[#edf0f5] pt-6 text-xs text-[#66758a]"><ShieldCheck size={15}/> Secure organization workspace</div></div><p className="mt-6 text-center text-sm text-[#66758a]">Already have an account? <Link href="/login" className="font-bold text-[#1769e0] hover:underline">Sign in</Link></p></div></section></div></main>
}
