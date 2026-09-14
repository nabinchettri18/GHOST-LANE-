export type GovernmentRecord = Record<string, unknown>

const BASE = 'https://api.data.gov.in/resource'

function requireKey() {
  const key = process.env.DATA_GOV_API_KEY
  if (!key) throw new Error('DATA_GOV_API_KEY is not configured')
  return key
}

export async function fetchDataGovResource(
  resourceId: string,
  filters: Record<string, string> = {},
  limit = 20,
): Promise<{ title?: string; total?: number; records: GovernmentRecord[]; fetchedAt: string }> {
  const key = requireKey()
  if (!/^[a-f0-9-]{20,}$/.test(resourceId)) throw new Error('Invalid data.gov.in resource id')

  const params = new URLSearchParams({
    'api-key': key,
    format: 'json',
    offset: '0',
    limit: String(Math.min(Math.max(limit, 1), 100)),
  })
  for (const [field, value] of Object.entries(filters)) {
    if (value.trim()) params.set(`filters[${field}]`, value.trim())
  }

  const response = await fetch(`${BASE}/${resourceId}?${params.toString()}`, {
    next: { revalidate: 900 },
  })
  if (!response.ok) throw new Error(`data.gov.in returned ${response.status}`)
  const body = await response.json() as { title?: string; total?: number; records?: GovernmentRecord[] }
  return { title: body.title, total: body.total, records: body.records ?? [], fetchedAt: new Date().toISOString() }
}

/**
 * CPCB real-time air-quality resource published through data.gov.in.
 * The resource is configurable because government resource IDs can change.
 */
export async function getGovernmentAirQuality(state: string, city: string) {
  const resourceId = process.env.DATA_GOV_AQI_RESOURCE_ID || '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'
  return fetchDataGovResource(resourceId, { state, city }, 20)
}

export type GovernmentProvider = {
  id: string
  name: string
  category: 'government-open' | 'government-authorized'
  configured: boolean
  source: string
  capabilities: string[]
}

export function getGovernmentProviders(): GovernmentProvider[] {
  return [
    {
      id: 'data-gov-in',
      name: 'Open Government Data India',
      category: 'government-open',
      configured: Boolean(process.env.DATA_GOV_API_KEY),
      source: 'data.gov.in',
      capabilities: ['transport datasets', 'vehicle statistics', 'road statistics', 'air quality', 'railway datasets'],
    },
    {
      id: 'ulip',
      name: 'Unified Logistics Interface Platform',
      category: 'government-authorized',
      configured: Boolean(process.env.ULIP_BASE_URL && process.env.ULIP_CLIENT_ID && process.env.ULIP_CLIENT_SECRET),
      source: 'ULIP / NLDSL',
      capabilities: ['authorized logistics APIs', 'shipment visibility', 'vehicle/asset context', 'transport ecosystem data'],
    },
    {
      id: 'gst-eway',
      name: 'GST / e-Way Bill ecosystem',
      category: 'government-authorized',
      configured: Boolean(process.env.GST_API_BASE_URL && process.env.GST_CLIENT_ID && process.env.GST_CLIENT_SECRET),
      source: 'Authorized GST/GSP integration',
      capabilities: ['e-way bill movement context', 'authorized tax/shipment records'],
    },
  ]
}
