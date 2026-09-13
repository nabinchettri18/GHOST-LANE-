'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
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
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, company_name: companyName } } })
    if (error) setError(error.message)
    else if (data.session) window.location.assign('/')
    else setMessage('Check your email to verify your account. Your private workspace will be created automatically.')
    setLoading(false)
  }

  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-10 text-[#08111f]"><div className="mx-auto max-w-md"><Link href="/login" className="text-sm font-bold text-[#1769e0]">← Back to sign in</Link><div className="mt-8 rounded-2xl border border-[#dbe2ec] bg-white p-8 shadow-[0_12px_40px_rgba(8,17,31,.05)]"><div className="mb-8"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769e0] font-extrabold text-white">G</div><span className="text-lg font-extrabold">GhostLane</span></div><h1 className="mt-8 text-2xl font-extrabold tracking-tight">Create your workspace</h1><p className="mt-2 text-sm leading-6 text-[#66758a]">Your first organization and owner membership are created automatically.</p></div><form onSubmit={submit} className="space-y-5"><div><label className="mb-2 block text-sm font-bold">Full name</label><input name="full_name" required autoComplete="name" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10"/></div><div><label className="mb-2 block text-sm font-bold">Company</label><input name="company_name" required autoComplete="organization" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10"/></div><div><label className="mb-2 block text-sm font-bold">Work email</label><input name="email" type="email" required autoComplete="email" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="name@company.com"/></div><div><label className="mb-2 block text-sm font-bold">Password</label><input name="password" type="password" required minLength={10} autoComplete="new-password" className="h-12 w-full rounded-xl border border-[#cbd6e5] px-4 text-sm outline-none focus:border-[#1769e0] focus:ring-4 focus:ring-[#1769e0]/10" placeholder="At least 10 characters"/></div>{error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="rounded-xl border border-[#b9d3ff] bg-[#edf4ff] px-4 py-3 text-sm text-[#164f9f]">{message}</p>}<button disabled={loading} className="h-12 w-full rounded-xl bg-[#1769e0] text-sm font-bold text-white hover:bg-[#0f57bd] disabled:opacity-60">{loading?'Creating workspace…':'Create workspace'}</button></form><p className="mt-6 text-center text-sm text-[#66758a]">Already have an account? <Link href="/login" className="font-bold text-[#1769e0]">Sign in</Link></p></div></div></main>
}
