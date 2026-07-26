/**
 * A transient, non-configuration failure (network unreachable, backend
 * returning a 5xx/429, etc.), as opposed to a genuine application error
 * (misconfiguration, missing scopes, malformed data). Only errors of this
 * kind are eligible for persistent-cache failover - see
 * `shouldSkipBackendError()`.
 */
export class BackendServerError extends Error {}

/**
 * Decides whether a failure should be swallowed in favor of falling back to
 * a last-known-good cached value (see `createPersistentCache()`), rather
 * than surfacing the error. Only applies when both:
 * - the `display_errors` debug setting is off (when it's on, the raw error
 *   always wins, by design, so operators can diagnose real problems), and
 * - the error is a `BackendServerError` (a transient failure that a cached
 *   value can plausibly paper over, as opposed to a genuine error that a
 *   stale cache wouldn't fix anyway).
 */
export function shouldSkipBackendError(
  error: unknown,
  displayErrors: boolean,
): boolean {
  return error instanceof BackendServerError && !displayErrors
}
