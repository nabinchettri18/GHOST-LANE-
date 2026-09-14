import { NextRequest, NextResponse } from 'next/server'

const geocode = async (query: string) => {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'GhostLane/1.0 logistics routing' }, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error('Geocoding provider unavailable')
  const data = await res.json()
  if (!data?.[0]) return null
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name }
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get('origin')?.trim()
  const destination = req.nextUrl.searchParams.get('destination')?.trim()
  if (!origin || !destination) return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 })

  try {
    const [a, b] = await Promise.all([geocode(origin), geocode(destination)])
    if (!a || !b) return NextResponse.json({ error: 'Could not geocode origin or destination' }, { status: 404 })

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=true`
    const routeRes = await fetch(routeUrl, { next: { revalidate: 300 } })
    if (!routeRes.ok) throw new Error('Routing provider unavailable')
    const route = await routeRes.json()
    if (route.code !== 'Ok' || !route.routes?.[0]) throw new Error('No drivable route found')

    const r = route.routes[0]
    return NextResponse.json({
      origin: a,
      destination: b,
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      geometry: r.geometry,
      steps: (r.legs?.[0]?.steps || []).slice(0, 25).map((s: any) => ({
        instruction: s.maneuver?.instruction || s.name || s.maneuver?.type || 'Continue',
        distanceM: s.distance,
      })),
    })
  } catch (error) {
    console.error('GhostLane route API error', error)
    return NextResponse.json({ error: 'Routing service temporarily unavailable' }, { status: 502 })
  }
}
