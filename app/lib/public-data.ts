export type GeoLocation = {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  timezone?: string
  elevation?: number
}

export type WeatherSnapshot = {
  temperatureC: number | null
  precipitationMm: number | null
  precipitationProbability: number | null
  windKph: number | null
  visibilityM: number | null
  weatherCode: number | null
  timezone: string | null
}

export type PublicLaneSignals = {
  source: 'open-meteo'
  origin: GeoLocation
  destination: GeoLocation
  distanceKm: number
  originWeather: WeatherSnapshot
  destinationWeather: WeatherSnapshot
  weatherRisk: 'Low' | 'Medium' | 'High'
  fetchedAt: string
}

const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 900 } })
  if (!response.ok) throw new Error(`Public data provider returned ${response.status}`)
  return response.json() as Promise<T>
}

export async function geocode(place: string): Promise<GeoLocation> {
  const params = new URLSearchParams({ name: place, count: '1', language: 'en', format: 'json' })
  const data = await fetchJson<{ results?: GeoLocation[] }>(`${OPEN_METEO_GEOCODE}?${params}`)
  const result = data.results?.[0]
  if (!result) throw new Error(`Could not resolve location: ${place}`)
  return result
}

export async function weather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,precipitation,precipitation_probability,wind_speed_10m,visibility,weather_code',
    timezone: 'auto',
  })
  const data = await fetchJson<{
    timezone?: string
    current?: Record<string, number | string | null>
  }>(`${OPEN_METEO_FORECAST}?${params}`)
  const c = data.current ?? {}
  return {
    temperatureC: typeof c.temperature_2m === 'number' ? c.temperature_2m : null,
    precipitationMm: typeof c.precipitation === 'number' ? c.precipitation : null,
    precipitationProbability: typeof c.precipitation_probability === 'number' ? c.precipitation_probability : null,
    windKph: typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : null,
    visibilityM: typeof c.visibility === 'number' ? c.visibility : null,
    weatherCode: typeof c.weather_code === 'number' ? c.weather_code : null,
    timezone: data.timezone ?? null,
  }
}

function haversineKm(a: GeoLocation, b: GeoLocation) {
  const earthRadius = 6371
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function weatherSeverity(w: WeatherSnapshot) {
  let score = 0
  if ((w.precipitationMm ?? 0) >= 10) score += 2
  else if ((w.precipitationMm ?? 0) >= 3) score += 1
  if ((w.precipitationProbability ?? 0) >= 70) score += 1
  if ((w.windKph ?? 0) >= 50) score += 2
  else if ((w.windKph ?? 0) >= 30) score += 1
  if ((w.visibilityM ?? 10000) < 2000) score += 2
  else if ((w.visibilityM ?? 10000) < 5000) score += 1
  if ([65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 95, 96, 99].includes(w.weatherCode ?? -1)) score += 2
  return score
}

export async function getPublicLaneSignals(originName: string, destinationName: string): Promise<PublicLaneSignals> {
  const [origin, destination] = await Promise.all([geocode(originName), geocode(destinationName)])
  const [originWeather, destinationWeather] = await Promise.all([
    weather(origin.latitude, origin.longitude),
    weather(destination.latitude, destination.longitude),
  ])
  const severity = Math.max(weatherSeverity(originWeather), weatherSeverity(destinationWeather))
  return {
    source: 'open-meteo',
    origin,
    destination,
    distanceKm: Math.round(haversineKm(origin, destination)),
    originWeather,
    destinationWeather,
    weatherRisk: severity >= 4 ? 'High' : severity >= 2 ? 'Medium' : 'Low',
    fetchedAt: new Date().toISOString(),
  }
}
