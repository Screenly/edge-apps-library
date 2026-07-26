export interface PersistentCache {
  /** Reads and JSON-parses the value stored under `key`, or `null` if missing, unreadable, or storage is unavailable. */
  read<T>(key: string): T | null
  /** JSON-serializes and stores `value` under `key`. Fails silently if storage is unavailable, disabled, or full. */
  write(key: string, value: unknown): void
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/**
 * Creates a `localStorage`-backed cache namespaced under `namespace`, for
 * Edge Apps that want to fall back to the last-known-good value when a live
 * fetch fails (e.g. a transient network or backend error). There is no TTL:
 * callers are expected to only consult the cache after a genuine fetch
 * failure, so staleness is bounded by how often fetches succeed rather than
 * by a clock.
 */
export function createPersistentCache(namespace: string): PersistentCache {
  const prefix = `${namespace}:`

  function read<T>(key: string): T | null {
    const storage = getStorage()
    if (!storage) return null

    try {
      const raw = storage.getItem(`${prefix}${key}`)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  function write(key: string, value: unknown): void {
    const storage = getStorage()
    if (!storage) return

    try {
      storage.setItem(`${prefix}${key}`, JSON.stringify(value))
    } catch {
      // Storage disabled or quota exceeded; caller simply has nothing cached.
    }
  }

  return { read, write }
}
