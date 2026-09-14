import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isSafeSubject(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 180 && !/[\r\n]/.test(value)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()
    const to = body?.to
    const subject = body?.subject
    const html = body?.html
    const text = body?.text

    if (!isValidEmail(to) || !isSafeSubject(subject) || typeof html !== 'string' || !html.trim() || html.length > 200_000) {
      return NextResponse.json({ error: 'Invalid email payload.' }, { status: 400 })
    }

    if (typeof text !== 'undefined' && (typeof text !== 'string' || text.length > 200_000)) {
      return NextResponse.json({ error: 'Invalid plain-text email body.' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service is not configured.' }, { status: 503 })
    }

    const from = process.env.RESEND_FROM_EMAIL || 'GhostLane <onboarding@resend.dev>'

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: subject.trim(),
        html,
        ...(typeof text === 'string' && text.trim() ? { text } : {}),
      }),
      cache: 'no-store',
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('Resend email error:', { status: response.status, result })
      return NextResponse.json(
        { error: 'The email provider rejected the message.' },
        { status: response.status >= 500 ? 502 : response.status },
      )
    }

    return NextResponse.json({ success: true, id: result?.id })
  } catch (error) {
    console.error('Email route error:', error)
    return NextResponse.json({ error: 'Unable to send email.' }, { status: 500 })
  }
}
