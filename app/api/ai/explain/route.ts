import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowRequest, isSameOrigin } from '@/lib/security'

type ExplainRequest = {
  entityType: 'lane' | 'shipment' | 'procurement' | 'optimization'
  entityId: string
  context: {
    origin?: string
    destination?: string
    carrier?: string
    riskScore?: number
    realizationRate?: number
    costVariance?: number
    transitVariance?: number
    contractedVolume?: number
    materializedVolume?: number
    exceptionType?: string
  }
}

function generateDeterministicExplanation(req: ExplainRequest) {
  const { entityType, context } = req
  const risk = Number(context.riskScore || 0)
  const realization = Number(context.realizationRate || 0)
  const factors: string[] = []
  const assumptions: string[] = []

  if (entityType === 'lane' || entityType === 'procurement') {
    if (realization > 0 && realization < 65) {
      factors.push(`Historical movement is only ${realization.toFixed(1)}% of contracted capacity, creating unused phantom capacity.`)
    }
    if (context.contractedVolume && context.materializedVolume) {
      const gap = Math.max(0, context.contractedVolume - context.materializedVolume)
      factors.push(`Realized volume gap of ${gap.toLocaleString()} units observed over recent periods.`)
    }
    if (risk >= 70) {
      factors.push('High volatility in carrier acceptance and recurring route exceptions.')
    }
    assumptions.push('Past realization over the trailing 90-180 days is representative of near-term demand.')
    assumptions.push('Carrier tariffs remain fixed under existing service terms.')

    const recommendation = risk >= 70
      ? 'Renegotiate baseline commitment downward by 30-40% and transition excess volume to indexed spot tiers.'
      : risk >= 45
      ? 'Implement tiered commitment structure with dynamic monthly true-ups.'
      : 'Maintain dedicated annual contract to capture maximum carrier volume rebates.'

    return {
      explanation: `GhostLane analyzed ${context.origin || 'origin'} → ${context.destination || 'destination'} lane metrics. ${factors.join(' ')}`,
      recommendation,
      supportingFactors: factors.length ? factors : ['Sufficient historical records available; performance consistent with target.'],
      assumptions,
      confidence: factors.length >= 2 ? 0.92 : 0.78,
      source: 'deterministic-rules',
    }
  }

  // Shipment explanation
  if (context.costVariance && context.costVariance > 0) {
    factors.push(`Actual freight charges exceeded budgeted expectation by ₹${Math.round(context.costVariance).toLocaleString('en-IN')}.`)
  }
  if (context.transitVariance && context.transitVariance > 0) {
    factors.push(`Transit duration exceeded lane schedule by ${context.transitVariance.toFixed(1)} hours.`)
  }
  if (context.exceptionType) {
    factors.push(`Operational exception logged: ${context.exceptionType.replace(/_/g, ' ')}.`)
  }
  assumptions.push('GPS telematics and carrier milestone timestamps reflect confirmed dock arrivals.')

  return {
    explanation: factors.length
      ? `Execution deviation observed for shipment ${req.entityId}. ${factors.join(' ')}`
      : `Shipment ${req.entityId} executed within acceptable tolerances of the lane plan.`,
    recommendation: factors.length
      ? 'Feed variance back into lane scoring to adjust future carrier allocation weights.'
      : 'Record successful carrier performance as positive baseline evidence.',
    supportingFactors: factors.length ? factors : ['On-time dispatch and arrival without recorded exceptions.'],
    assumptions,
    confidence: 0.90,
    source: 'deterministic-rules',
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!allowRequest(`ai-explain:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Workspace membership required' }, { status: 403 })

  const body = await request.json().catch(() => null) as ExplainRequest | null
  if (!body || !body.entityType || !body.entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
  }

  const deterministic = generateDeterministicExplanation(body)
  const apiKey = process.env.GEMINI_API_KEY
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  const candidateModels = Array.from(new Set([preferredModel, 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro']))

  let finalResponse = {
    entityType: body.entityType,
    entityId: body.entityId,
    explanation: deterministic.explanation,
    recommendation: deterministic.recommendation,
    supportingFactors: deterministic.supportingFactors,
    assumptions: deterministic.assumptions,
    confidence: deterministic.confidence,
    provider: deterministic.source,
  }

  // If Gemini AI API is configured, enrich the natural language explanation using the best model
  if (apiKey) {
    const prompt = `You are GhostLane Explainability Engine, a senior freight procurement analyst.
Explain this logistics decision based strictly on verified inputs:
Entity: ${body.entityType} ${body.entityId}
Context: ${JSON.stringify(body.context)}
Rules: Never fabricate external market facts. Be crisp, professional, strategic, and procurement-oriented.
Return valid JSON with: { "explanation": string, "recommendation": string }`

    for (const model of candidateModels) {
      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          }),
        })

        if (aiRes.ok) {
          const aiData = await aiRes.json()
          const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const parsed = JSON.parse(text)
            if (parsed.explanation) finalResponse.explanation = parsed.explanation
            if (parsed.recommendation) finalResponse.recommendation = parsed.recommendation
            finalResponse.provider = `gemini-ai (${model})`
            break // Successfully generated with the best available model
          }
        }
      } catch (e) {
        console.warn(`Model ${model} unavailable, trying next candidate:`, e)
      }
    }
  }

  // Persist to ai_explanations table if present
  try {
    const db = createAdminClient()
    await db.from('ai_explanations').insert({
      organization_id: membership.organization_id,
      entity_type: body.entityType,
      entity_id: body.entityId,
      prompt_version: 'v1.0',
      explanation: finalResponse.explanation,
      supporting_factors: finalResponse.supportingFactors,
      assumptions: finalResponse.assumptions,
      confidence: finalResponse.confidence,
    })
  } catch (logErr) {
    // Non-fatal logging
  }

  return NextResponse.json(finalResponse)
}
