import { NextRequest, NextResponse } from 'next/server'

const CUOPT_API = 'https://optimize.api.nvidia.com/v1/nvidia/cuopt'
const CUOPT_STATUS = 'https://optimize.api.nvidia.com/v1/status'

type OptimizeBody = {
  distanceKm: number
  durationMin: number
  vehicleCapacity?: number
  demand?: number
}

async function pollCuOpt(reqId: string, apiKey: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${CUOPT_STATUS}/${encodeURIComponent(reqId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 202) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }
    if (!res.ok) throw new Error(data?.detail || data?.message || 'NVIDIA cuOpt status request failed')
    return data
  }
  return { status: 'pending', message: 'Optimization is still running', reqId }
}

export async function POST(req: NextRequest) {
  // Accept the exact NVCF key name used by NVIDIA Build, plus the previous
  // GhostLane names so existing deployments keep working during migration.
  const apiKey =
    process.env.NVCF_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    process.env.NVIDIA_CUOPT_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      provider: 'nvidia-cuopt',
      message: 'NVIDIA cuOpt is not configured. Add NVCF_API_KEY in Vercel environment variables.',
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

  const data = {
    cost_waypoint_graph_data: null,
    travel_time_waypoint_graph_data: null,
    cost_matrix_data: { data: { '0': [[0, distance], [distance, 0]] } },
    travel_time_matrix_data: { data: { '0': [[0, duration], [duration, 0]] } },
    task_data: {
      task_locations: [1],
      task_ids: ['ghostlane-shipment'],
      demand: [[demand]],
      task_time_windows: [[0, Math.max(duration * 2, 86400)]],
      service_times: [0],
    },
    fleet_data: {
      vehicle_locations: [[0, 0]],
      vehicle_ids: ['ghostlane-vehicle'],
      vehicle_types: [0],
      capacities: [[capacity]],
      vehicle_time_windows: [[0, Math.max(duration * 2, 86400)]],
    },
    solver_config: {
      time_limit: 5,
      objectives: { cost: 1, travel_time: 1 },
    },
  }

  try {
    const response = await fetch(CUOPT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action: 'cuOpt_OptimizedRouting',
        data,
        parameters: {},
        client_version: 'custom',
      }),
      cache: 'no-store',
    })

    const result = await response.json().catch(() => ({}))

    if (response.status === 202 && result?.reqId) {
      const finalResult = await pollCuOpt(result.reqId, apiKey)
      return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', result: finalResult })
    }

    if (!response.ok) {
      return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', error: result }, { status: response.status })
    }

    return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', result })
  } catch (error) {
    console.error('GhostLane NVIDIA cuOpt error', error)
    return NextResponse.json({ configured: true, provider: 'nvidia-cuopt', error: 'NVIDIA optimization service unavailable' }, { status: 502 })
  }
}
