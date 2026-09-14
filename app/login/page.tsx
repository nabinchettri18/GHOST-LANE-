'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)

    try {
      const form = new FormData(event.currentTarget)
      const email = String(form.get('email') || '').trim()
      const password = String(form.get('password') || '')
      if (!email || !password) throw new Error('Enter your work email and password.')

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      // Workspace provisioning is server-side. Never leave the button spinning
      // forever if a deployment has a missing/invalid admin configuration.
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)
      try {
        const bootstrap = await fetch('/api/workspace/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const bootstrapBody = await bootstrap.json().catch(() => ({})) as { error?: string }
        if (!bootstrap.ok) {
          throw new Error(bootstrapBody.error || 'We could not initialize your GhostLane workspace.')
        }
      } finally {
        window.clearTimeout(timeout)
      }

      window.location.assign('/')
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === 'AbortError'
        ? 'Sign-in is taking too long. Check your Supabase/Vercel configuration and try again.'
        : caught instanceof Error
          ? caught.message
          : 'Unable to sign in. Please try again.'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#08111f]"><div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden border-r border-[#dbe2ec] bg-white px-12 py-12 lg:flex lg:flex-col lg:justify-between"><div>
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div><span className="text-lg font-extrabold tracking-tight">GhostLane</span></div>
        <div className="mt-24 max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#1769e0]">Procurement intelligence</p><h1 className="mt-5 text-5xl font-extrabold tracking-[-0.04em] leading-[1.05]">Know which capacity will actually move.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-[#526174]">Understand contracted capacity, lane realization and procurement exposure from one operational workspace.</p></div>
      </div><div className="grid grid-cols-3 gap-6 border-t border-[#dbe2ec] pt-6 text-sm"><div><p className="font-bold">Lane visibility</p><p className="mt-1 text-[#66758a]">Contract to movement</p></div><div><p className="font-bold">Risk analysis</p><p className="mt-1 text-[#66758a]">Evidence by lane</p></div><div><p className="font-bold">Scenarios</p><p className="mt-1 text-[#66758a]">Plan before commitment</p></div></div></section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] text-sm font-extrabold text-white">G</div><span className="text-lg font-extrabold">GhostLane</span></div></div>
        <div className="rounded-2xl border border-[#dbe2ec] bg-white p-7 shadow-[0_12px_40px_rgba(8,17,31,0.05)] sm:p-9"><div className="mb-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769e0]"><LockKeyhole size={20}/></div><h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2><p className="mt-2 text-sm leading-6 text-[#66758a]">Access your GhostLane workspace.</p></div>
          <form onSubmit={submit} className="space-y-5"><div><label htmlFor="email" className="mb-2 block text-sm font-bold">Work email</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="name@company.com" className="h-12 w-full rounded-xl border border-[#cbd6e5] bg-white px-4 text-sm outline-none transition placeholder:text-[#9aa7b7] focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10"/></div>
            <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-bold">Password</label><Link href="/forgot-password" className="text-xs font-bold text-[#1769e0] hover:underline">Forgot password?</Link></div><div className="relative"><input id="password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" required placeholder="Enter your password" className="h-12 w-full rounded-xl border border-[#cbd6e5] bg-white px-4 pr-12 text-sm outline-none transition placeholder:text-[#9aa7b7] focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#66758a] hover:bg-[#f0f5fc]">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
            {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[#1769e0] text-sm font-bold text-white shadow-sm transition hover:bg-[#0f57bd] disabled:cursor-not-allowed disabled:opacity-60">{loading?'Signing in…':'Sign in'}</button>
          </form><div className="mt-7 flex items-center justify-center gap-2 border-t border-[#edf0f5] pt-6 text-xs text-[#66758a]"><ShieldCheck size={15}/> Secure workspace access</div></div><p className="mt-6 text-center text-xs leading-5 text-[#8290a2]">By continuing, you agree to your organization's GhostLane access policy.</p>
      </div></section></div></main>
  )
}
