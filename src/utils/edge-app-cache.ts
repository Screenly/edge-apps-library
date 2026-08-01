function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/**
 * Reads and JSON-parses the value stored under `${namespace}:${key}` in
 * `localStorage`, or `null` if missing, unreadable, or storage is
 * unavailable. Meant for last-known-good fallback data for Edge Apps:
 * consult it only after a genuine fetch failure, not as a general-purpose
 * expiring cache — there is no TTL, and `localStorage` itself isn't
 * guaranteed to survive a device reboot.
 */
export function readEdgeAppCache<T>(namespace: string, key: string): T | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(`${namespace}:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * JSON-serializes and stores `value` under `${namespace}:${key}` in
 * `localStorage`. Fails silently if storage is unavailable, disabled, or
 * full.
 */
export function writeEdgeAppCache(
  namespace: string,
  key: string,
  value: unknown,
): void {
  const storage = getStorage()
  if (!storage) return

  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return
    storage.setItem(`${namespace}:${key}`, serialized)
  } catch {
    // Storage disabled or quota exceeded; caller simply has nothing cached.
  }
}
