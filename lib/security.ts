import type { NextRequest } from 'next/server'

/** Defense-in-depth CSRF check for state-changing browser requests. */
export function isSameOrigin(request: Request | NextRequest) {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (origin && origin !== new URL(request.url).origin) return false
  if (fetchSite === 'cross-site') return false
  return true
}

/** Best-effort per-instance limiter. Use a shared store for production-scale enforcement. */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}
