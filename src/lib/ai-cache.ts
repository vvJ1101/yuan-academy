/**
 * Simple in-memory TTL cache for DeepSeek API calls.
 * Reduces duplicate API costs for identical prompts.
 */

interface CacheEntry {
  response: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes

/** Generate a cache key from messages array */
export function cacheKey(model: string, messages: { role: string; content: string }[]): string {
  const content = messages.map(m => `${m.role}:${m.content.substring(0, 200)}`).join('|')
  return `${model}::${content}`
}

/** Get cached response, returns null if miss or expired */
export function getCached(key: string): string | null {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.response
}

/** Store response in cache */
export function setCache(key: string, response: string, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { response, expiresAt: Date.now() + ttlMs })
  // Limit cache size to 200 entries
  if (cache.size > 200) {
    const firstKey = Array.from(cache.keys())[0]
    if (firstKey) cache.delete(firstKey)
  }
}

/** Clear all cached entries */
export function clearCache(): void { cache.clear() }

/** Get cache stats */
export function cacheStats() {
  return { size: cache.size, entries: Array.from(cache.keys()).slice(0, 5) }
}
