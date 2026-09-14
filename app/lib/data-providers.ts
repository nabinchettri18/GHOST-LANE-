export type ProviderStatus = 'ready' | 'needs_credentials' | 'not_configured'

export type ProviderInfo = {
  id: string
  name: string
  description: string
  status: ProviderStatus
  mode: 'public' | 'authorized'
  note: string
}

/**
 * Server-side provider registry. Secrets are intentionally never exposed here.
 * Public providers can work without credentials; authorized government feeds
 * become available only after the organization supplies its own access details.
 */
export function getProviderStatuses(): ProviderInfo[] {
  const dataGovKey = Boolean(process.env.DATA_GOV_API_KEY)
  const ulipConfigured = Boolean(
    process.env.ULIP_BASE_URL &&
    process.env.ULIP_CLIENT_ID &&
    process.env.ULIP_CLIENT_SECRET,
  )
  const gstConfigured = Boolean(
    process.env.GST_API_BASE_URL &&
    process.env.GST_CLIENT_ID &&
    process.env.GST_CLIENT_SECRET,
  )

  return [
    {
      id: 'open-meteo',
      name: 'Open-Meteo',
      description: 'Public weather and geospatial context for lane conditions.',
      status: 'ready',
      mode: 'public',
      note: 'No API key required for this public adapter.',
    },
    {
      id: 'data-gov-in',
      name: 'data.gov.in',
      description: 'Open Government Data datasets and APIs for public transport context.',
      status: dataGovKey ? 'ready' : 'not_configured',
      mode: 'public',
      note: dataGovKey ? 'API key detected on the server.' : 'Optional DATA_GOV_API_KEY can be added for API access.',
    },
    {
      id: 'ulip',
      name: 'ULIP',
      description: 'Authorized logistics ecosystem integrations exposed through ULIP.',
      status: ulipConfigured ? 'ready' : 'needs_credentials',
      mode: 'authorized',
      note: ulipConfigured ? 'Authorized connector configuration detected.' : 'Requires an organization-approved ULIP integration and credentials.',
    },
    {
      id: 'gst-eway',
      name: 'GST / e-Way Bill',
      description: 'Authorized GST ecosystem data for shipment and movement context.',
      status: gstConfigured ? 'ready' : 'needs_credentials',
      mode: 'authorized',
      note: gstConfigured ? 'Authorized connector configuration detected.' : 'Requires an approved GSP/ASP or authorized API integration.',
    },
  ]
}
