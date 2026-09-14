import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowRequest, isSameOrigin } from '@/lib/security'

type LaneRow = {
  id: string
  origin: string
  destination: string
  mode: string
  contracted_volume: number | null
  materialized_volume: number | null
  carrier: string | null
  risk_score: number | null
}

type ContractRow = {
  id: string
  contract_id: string | null
  lane_id: string
  carrier: string | null
  contracted_volume: number | null
  start_date: string
  end_date: string
}

type ShipmentRow = {
  lane_id: string
  carrier: string | null
  volume: number | null
  status: string | null
}

function safeNumber(value: number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allowRequest(`ai:${user.id}`, 10, 60_000)) return NextResponse.json({ error: 'Too many AI investigations. Please wait a minute.' }, { status: 429 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured yet. Add GEMINI_API_KEY to the server environment.' }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const question = typeof (body as { question?: unknown })?.question === 'string'
    ? (body as { question: string }).question.trim()
    : ''
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  if (question.length > 1200) return NextResponse.json({ error: 'Question is too long' }, { status: 400 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No workspace membership found' }, { status: 403 })

  const [{ data: lanes, error: laneError }, { data: contracts, error: contractError }, { data: shipments, error: shipmentError }] = await Promise.all([
    supabase.from('lanes').select('id,origin,destination,mode,contracted_volume,materialized_volume,carrier,risk_score').eq('organization_id', membership.organization_id).limit(5000),
    supabase.from('contracts').select('id,contract_id,lane_id,carrier,contracted_volume,start_date,end_date').eq('organization_id', membership.organization_id).order('start_date', { ascending: false }).limit(1000),
    supabase.from('shipments').select('lane_id,carrier,volume,status').eq('organization_id', membership.organization_id).limit(5000),
  ])

  if (laneError) return NextResponse.json({ error: laneError.message }, { status: 500 })
  if (contractError) return NextResponse.json({ error: contractError.message }, { status: 500 })
  if (shipmentError) return NextResponse.json({ error: shipmentError.message }, { status: 500 })

  const laneRows = (lanes ?? []) as LaneRow[]
  const contractRows = (contracts ?? []) as ContractRow[]
  const shipmentRows = (shipments ?? []) as ShipmentRow[]
  if (!laneRows.length && !contractRows.length && !shipmentRows.length) {
    return NextResponse.json({ error: 'There is not enough workspace data to investigate yet.' }, { status: 422 })
  }

  const laneMap = new Map(laneRows.map(lane => [lane.id, lane]))
  const shipmentAgg = new Map<string, { volume: number; count: number; cancelled: number }>()
  for (const shipment of shipmentRows) {
    const key = shipment.lane_id
    const current = shipmentAgg.get(key) ?? { volume: 0, count: 0, cancelled: 0 }
    const cancelled = String(shipment.status ?? '').trim().toLowerCase() === 'cancelled'
    if (cancelled) current.cancelled += 1
    else current.volume += Math.max(0, safeNumber(shipment.volume))
    current.count += 1
    shipmentAgg.set(key, current)
  }

  const laneEvidence = laneRows.map(lane => {
    const contracted = safeNumber(lane.contracted_volume)
    const materialized = safeNumber(lane.materialized_volume)
    const ghostRate = contracted > 0 ? Math.max(0, (contracted - materialized) / contracted * 100) : null
    const shipments = shipmentAgg.get(lane.id)
    return {
      lane_id: lane.id,
      lane: `${lane.origin} → ${lane.destination}`,
      mode: lane.mode,
      carrier: lane.carrier,
      contracted_volume: contracted,
      materialized_volume: materialized,
      ghost_rate_pct: ghostRate == null ? null : Number(ghostRate.toFixed(1)),
      risk_score: lane.risk_score,
      shipment_count: shipments?.count ?? 0,
      shipment_volume: shipments?.volume ?? 0,
      cancelled_shipments: shipments?.cancelled ?? 0,
    }
  }).sort((a, b) => (b.ghost_rate_pct ?? -1) - (a.ghost_rate_pct ?? -1)).slice(0, 200)

  const contractEvidence = contractRows.slice(0, 300).map(contract => {
    const lane = laneMap.get(contract.lane_id)
    return {
      contract_id: contract.contract_id ?? contract.id,
      lane: lane ? `${lane.origin} → ${lane.destination}` : contract.lane_id,
      carrier: contract.carrier,
      contracted_volume: safeNumber(contract.contracted_volume),
      start_date: contract.start_date,
      end_date: contract.end_date,
    }
  })

  const context = JSON.stringify({
    workspace_scope: 'authenticated organization only',
    evidence_limits: 'Top 200 lane records by observed ghost rate and latest 300 contracts. Shipment data is aggregated by lane; cancelled shipments are separated.',
    lanes: laneEvidence,
    contracts: contractEvidence,
  })

  const systemInstruction = `You are GhostLane Investigator, an enterprise freight procurement analyst. Answer only from the supplied workspace evidence. Never invent lanes, carriers, volumes, dates, savings, market facts, or model results. If the evidence cannot answer a question, explicitly say what is missing. Distinguish observed historical metrics from recommendations. Do not claim to have live access to ULIP, FASTag, E-Way Bill, market rates, weather, or any external system unless such evidence is explicitly present. Keep the answer concise and decision-oriented. Structure the response as: Answer, Evidence, Recommended next step. Mention the exact lane/carrier/metric when supported by the evidence.`

  const prompt = `${systemInstruction}\n\nWorkspace evidence:\n${context}\n\nUser question:\n${question}`

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  const candidateModels = Array.from(new Set([preferredModel, 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro']))

  let answer: string | null = null
  let usedModel = preferredModel

  for (const model of candidateModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      })

      if (response.ok) {
        const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const candidateText = result.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim()
        if (candidateText) {
          answer = candidateText
          usedModel = model
          break
        }
      }
    } catch (err) {
      console.warn(`Model ${model} failed, trying next candidate:`, err)
    }
  }

  if (!answer) {
    const topRiskLanes = [...laneEvidence].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 3)
    const topGhostLanes = [...laneEvidence].filter(l => (l.ghost_rate_pct ?? 0) > 0).slice(0, 3)
    const totalContracted = laneEvidence.reduce((sum, l) => sum + (l.contracted_volume || 0), 0)
    const totalMaterialized = laneEvidence.reduce((sum, l) => sum + (l.materialized_volume || 0), 0)
    const realizationRate = totalContracted > 0 ? ((totalMaterialized / totalContracted) * 100).toFixed(1) : '100'

    answer = `**Answer**:\nBased on ${laneEvidence.length} connected lanes and ${contractEvidence.length} active contracts in your workspace, your aggregate capacity realization is ${realizationRate}% (${totalMaterialized.toLocaleString()} materialized out of ${totalContracted.toLocaleString()} contracted units).\n\n` +
      `**Evidence**:\n` +
      `- **Highest Ghost Risk Corridors**: ${topRiskLanes.map(l => `${l.lane} (${l.carrier || 'Unassigned'}, Risk: ${l.risk_score ?? 'N/A'}, Ghost Rate: ${l.ghost_rate_pct ?? 0}%)`).join('; ') || 'No elevated risk detected'}\n` +
      `- **Underutilized Capacity Gaps**: ${topGhostLanes.map(l => `${l.lane} (${l.ghost_rate_pct}% phantom capacity)`).join(', ') || 'All contracted capacity moving on schedule'}\n\n` +
      `**Recommended next step**:\nTransition high-risk lanes (≥ 70 score) to flexible procurement tiers with monthly true-ups to prevent unrecoverable ghost freight spend.`

    usedModel = 'deterministic-rules-analyst'
  }

  return NextResponse.json({ model: usedModel, answer, evidence: { lanes: laneEvidence.length, contracts: contractEvidence.length, shipmentsAggregated: shipmentRows.length } })
}
