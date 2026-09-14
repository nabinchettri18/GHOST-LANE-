import { NextRequest, NextResponse } from 'next/server'

const CUOPT_API = 'https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions'
const CUOPT_STATUS = 'https://api.nvcf.nvidia.com/v2/nvcf/pexec/status'

type OptimizeBody = {
  distanceKm: number
  durationMin: number
  vehicleCapacity?: number
  demand?: number
}

async function pollCuOpt(reqId: string, token: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${CUOPT_STATUS}/${encodeURIComponent(reqId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.errorDescription || data?.message || 'NVIDIA cuOpt status request failed')
    if (data.status === 'fulfilled' || data.status === 'failed' || data.status === 'error') return data
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  return { status: 'pending', message: 'Optimization is still running', reqId }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.NVIDIA_CUOPT_API_KEY
  const functionId = process.env.NVIDIA_CUOPT_FUNCTION_ID
  const versionId = process.env.NVIDIA_CUOPT_VERSION_ID

  if (!apiKey || !functionId) {
    return NextResponse.json({
      configured: false,
      provider: 'nvidia-cuopt',
      message: 'NVIDIA cuOpt is not configured. Add NVIDIA_CUOPT_API_KEY and NVIDIA_CUOPT_FUNCTION_ID in Vercel environment variables.',
    }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as OptimizeBody | null
  if (!body || !Number.isFinite(body.distanceKm) || !Number.isFinite(body.durationMin)) {
    return NextResponse.json({ error: 'distanceKm and durationMin are required' }, { status: 400 })
  }

  const distance = Math.max(0, body.distanceKm * 1000)
  const duration = Math.max(0, body.durationMin * 60)
  const demand = Math.max(0, Number(body.demand ?? 1))
  const capacity = Math.max(demand, Number(body.vehicleCapacity ?? demand))

  // GhostLane passes the already-routed OSM/OSRM lane into cuOpt as a
  // two-location optimization problem. For multi-stop dispatch, the same
  // endpoint can later receive a larger cost/time matrix without changing
  // the NVIDIA integration boundary.
  const data = {
    cost_matrix_data: { data: { '0': [[0, distance], [distance, 0]] } },
    travel_time_matrix_data: { data: { '0': [[0, duration], [duration, 0]] } },
    task_data: {
      task_locations: [1],
      task_ids: ['ghostlane-shipment'],
      demand: [[demand]],
      service_times: [0],
    },
    fleet_data: {
      vehicle_locations: [[0, 0]],
      capacities: [[capacity]],
      vehicle_time_windows: [[0, Math.max(duration * 2, 86400)]],
    },
    solver_config: {
      time_limit: 5,
      objectives: { cost: 1, travel_time: 1 },
    },
  }

  const endpoint = versionId
    ? `${CUOPT_API}/${encodeURIComponent(functionId)}/versions/${encodeURIComponent(versionId)}`
    : `${CUOPT_API}/${encodeURIComponent(functionId)}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ data, client_version: 'ghostlane' }),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', error: result }, { status: response.status })
    }

    if (result?.reqId && result?.status && result.status !== 'fulfilled') {
      const finalResult = await pollCuOpt(result.reqId, apiKey)
      return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', result: finalResult })
    }

    return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', result })
  } catch (error) {
    console.error('GhostLane NVIDIA cuOpt error', error)
    return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', error: 'NVIDIA optimization service unavailable' }, { status: 502 })
  }
}
