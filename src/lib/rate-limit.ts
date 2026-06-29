/**
 * In-memory rate limiter for login API.
 * Tracks: IP → { count, resetAt }
 * Limit: 5 attempts per minute per IP
 */

const store = new Map<string, { count: number; resetAt: number }>()

// Auto-cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  const keys = Array.from(store.keys())
  for (const key of keys) {
    const entry = store.get(key)
    if (entry && now > entry.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(
  identifier: string,
  maxAttempts = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(identifier)

  // First attempt or window expired — reset
  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 }
  }

  entry.count++

  if (entry.count > maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: maxAttempts - entry.count, retryAfterSeconds: 0 }
}

/** Reset rate limit for an identifier (call on successful login) */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier)
}
