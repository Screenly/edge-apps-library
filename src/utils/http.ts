/**
 * HTTP Utilities
 * Shared helpers for making fetch requests and parsing JSON responses,
 * reducing boilerplate around checking `response.ok` and error handling.
 */

/**
 * Options accepted by `fetchJson` and `fetchJsonOrDefault`.
 * Extends the standard `fetch` options with an optional request timeout.
 */
export interface FetchJsonOptions extends RequestInit {
  /**
   * Abort the request after this many milliseconds. Defaults to
   * `DEFAULT_TIMEOUT_MS` when omitted. Pass `0` or `Infinity` to disable
   * the timeout entirely. If a `signal` is also provided, the timeout
   * takes precedence.
   */
  timeoutMs?: number
}

/**
 * Default request timeout applied by `fetchJson` when the caller does not
 * pass `timeoutMs`. Kept below the screenshotter's ~10s network-idle
 * budget so a fallback/error path still has time to run.
 */
export const DEFAULT_TIMEOUT_MS = 8000

/**
 * Error thrown by `fetchJson` when a response is received but its status
 * is outside the 200-299 range.
 */
export class FetchJsonError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
  ) {
    super(message)
    this.name = 'FetchJsonError'
  }
}

/**
 * Fetch a URL and parse the response body as JSON.
 *
 * Throws a `FetchJsonError` if the response status is not ok, or the
 * underlying `fetch` error (including an abort error on timeout) otherwise.
 * Callers that want a non-throwing variant should use `fetchJsonOrDefault`.
 *
 * @param url - URL to request
 * @param options - Standard fetch options, plus an optional `timeoutMs` to
 *   abort the request after a given duration (defaults to
 *   `DEFAULT_TIMEOUT_MS`; pass `0` or `Infinity` to disable)
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    init.signal = controller.signal
  }

  try {
    const response = await fetch(url, init)

    if (!response.ok) {
      throw new FetchJsonError(
        `Request to ${url} failed with status ${response.status}`,
        response.status,
        response.statusText,
        url,
      )
    }

    return (await response.json()) as T
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

/**
 * Fetch a URL and parse the response body as JSON, returning `fallback`
 * instead of throwing when the request fails (network error, timeout, or a
 * non-ok response status). Logs a `console.warn` with the failure reason.
 *
 * Useful for optional data where a failed request should not interrupt
 * rendering, e.g. an Edge App falling back to a default value.
 *
 * @param url - URL to request
 * @param fallback - Value returned when the request fails
 * @param options - Standard fetch options, plus an optional `timeoutMs`
 * @param warningMessage - Message logged (via `console.warn`) before the
 *   error, to give context on which request failed
 */
export async function fetchJsonOrDefault<T>(
  url: string,
  fallback: T,
  options: FetchJsonOptions = {},
  warningMessage = 'Failed to fetch JSON:',
): Promise<T> {
  try {
    return await fetchJson<T>(url, options)
  } catch (error) {
    console.warn(warningMessage, error)
    return fallback
  }
}
