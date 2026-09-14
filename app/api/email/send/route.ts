import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const to = body?.to
    const subject = body?.subject
    const html = body?.html
    const text = body?.text

    if (!isValidEmail(to) || typeof subject !== 'string' || !subject.trim() || typeof html !== 'string' || !html.trim()) {
      return NextResponse.json({ error: 'Invalid email payload.' }, { status: 400 })
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
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('Resend email error:', result)
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
