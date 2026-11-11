/**
 * HTTP Utilities
 * Shared helpers for making fetch requests and parsing JSON responses,
 * reducing boilerplate around checking `response.ok` and error handling.
 */
import { SENSITIVE_KEY_PATTERNS } from './sentry.js'

/**
 * Query param name patterns treated as sensitive when redacting a URL for
 * logging. Extends the shared `SENSITIVE_KEY_PATTERNS` from `sentry.ts`
 * with a couple of patterns specific to URL query params (e.g. `appid`,
 * `apikey`) without altering `sentry.ts`'s own behaviour.
 */
const URL_SENSITIVE_KEY_PATTERNS = [...SENSITIVE_KEY_PATTERNS, 'key', 'appid']

function isSensitiveQueryKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return URL_SENSITIVE_KEY_PATTERNS.some((pattern) =>
    lowerKey.includes(pattern),
  )
}

/**
 * Redact the values of any sensitive-looking query params (e.g. `token`,
 * `apikey`, `appid`) from a URL, for safe use in logs. Returns the original
 * string unchanged if it cannot be parsed as a URL.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitiveQueryKey(key)) {
        parsed.searchParams.set(key, '[REDACTED]')
      }
    }
    return parsed.toString()
  } catch {
    return url
  }
}

const MAX_LOGGED_BODY_LENGTH = 200

/**
 * Truncate a response body for safe use in logs, to avoid dumping large or
 * sensitive payloads into log output.
 */
export function truncateForLogging(body: string): string {
  return body.length > MAX_LOGGED_BODY_LENGTH
    ? `${body.slice(0, MAX_LOGGED_BODY_LENGTH)}...`
    : body
}

/**
 * Options accepted by `fetchJson` and `fetchJsonOrDefault`.
 * Extends the standard `fetch` options with an optional request timeout.
 */
export interface FetchJsonOptions extends RequestInit {
  /**
   * Abort the request after this many milliseconds. Defaults to
   * `DEFAULT_TIMEOUT_MS` when omitted. Pass `0` or `Infinity` to disable
   * the timeout entirely. If a `signal` is also provided, either it or the
   * timeout aborting will cancel the request.
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
 * is outside the 200-299 range. If the response body could be parsed as
 * JSON, the parsed value is available as `body` so callers can surface
 * API-provided error details (e.g. `{ "message": "invalid api key" }`).
 * `body` is left `undefined` when the response body was empty or was not
 * valid JSON, such as an HTML error page.
 */
export class FetchJsonError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'FetchJsonError'
  }
}

/**
 * Error thrown by `fetchJson` when a response is ok (status 200-299) but
 * its body is not valid JSON, such as an HTML error page served with a
 * 200, or a plain-text body. Distinct from `FetchJsonError` so callers can
 * tell "the request failed" apart from "the request succeeded but the
 * body could not be parsed" without inspecting a native `SyntaxError`.
 */
export class FetchJsonParseError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(message)
    this.name = 'FetchJsonParseError'
  }
}

/**
 * Fetch a URL and parse the response body as JSON.
 *
 * The response body is read once via `response.text()` (a `Response` body
 * can only be consumed once, so `.text()` and `.json()` cannot both be
 * called on it), then parsed with `JSON.parse`.
 *
 * Throws a `FetchJsonError` if the response status is not ok (its `body`
 * field carries the parsed error payload when the server returned one), a
 * `FetchJsonParseError` if the response is ok but its body is not valid
 * JSON, or the underlying `fetch` error (including an abort error on
 * timeout) otherwise. An ok response with an empty body resolves to
 * `undefined` rather than throwing, to accommodate responses such as a 204
 * No Content, so the resolved type is `T | undefined` and callers that
 * require a value should check for `undefined` explicitly. Callers that
 * want a non-throwing variant should use `fetchJsonOrDefault`.
 *
 * @param url - URL to request
 * @param options - Standard fetch options, plus an optional `timeoutMs` to
 *   abort the request after a given duration (defaults to
 *   `DEFAULT_TIMEOUT_MS`; pass `0` or `Infinity` to disable)
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T | undefined> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...init
  } = options
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let signal = callerSignal

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    signal = callerSignal
      ? AbortSignal.any([callerSignal, controller.signal])
      : controller.signal
  }

  try {
    const response = await fetch(url, { ...init, signal })
    const text = await response.text()

    if (!response.ok) {
      let body: unknown
      try {
        body = JSON.parse(text) as unknown
      } catch {
        body = undefined
      }

      throw new FetchJsonError(
        `Request to ${url} failed with status ${response.status}`,
        response.status,
        response.statusText,
        url,
        body,
      )
    }

    if (text === '') {
      return undefined
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new FetchJsonParseError(
        `Response from ${url} was not valid JSON`,
        url,
        text,
      )
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

/**
 * Fetch a URL and parse the response body as JSON, returning `fallback`
 * instead of throwing when the request fails (network error, timeout, a
 * non-ok response status, or an ok response whose body is not valid
 * JSON). Logs a `console.warn` with the failure reason.
 *
 * An ok response with an empty body also resolves to `fallback` here
 * rather than `undefined`, since this function's contract is to always
 * return a `T`.
 *
 * Useful for optional data where a failed request should not interrupt
 * rendering, e.g. an Edge App falling back to a default value.
 *
 * @param url - URL to request
 * @param fallback - Value returned when the request fails, or when an ok
 *   response resolves to `undefined` (an empty body)
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
    const result = await fetchJson<T>(url, options)
    return result === undefined ? fallback : result
  } catch (error) {
    console.warn(warningMessage, toLoggableError(error))
    return fallback
  }
}

/**
 * Build a safe-to-log representation of an error thrown by `fetchJson`,
 * with the URL's sensitive query params redacted and, for
 * `FetchJsonParseError`, the raw body truncated. Used only for logging;
 * callers still receive the original, unredacted error.
 */
function toLoggableError(error: unknown): unknown {
  if (error instanceof FetchJsonParseError) {
    const redactedUrl = redactUrl(error.url)
    return new FetchJsonParseError(
      `Response from ${redactedUrl} was not valid JSON`,
      redactedUrl,
      truncateForLogging(error.body),
    )
  }

  if (error instanceof FetchJsonError) {
    const redactedUrl = redactUrl(error.url)
    return new FetchJsonError(
      `Request to ${redactedUrl} failed with status ${error.status}`,
      error.status,
      error.statusText,
      redactedUrl,
      error.body,
    )
  }

  return error
}
