const TOKEN_REFRESH_INTERVAL_SEC = 30 * 60

/** Floor for an expiration-derived delay, so a near-expired token doesn't cause a refresh storm. */
const DEFAULT_MIN_REFRESH_DELAY_SEC = 10

/**
 * Fraction of a token's remaining lifetime to wait before refreshing again,
 * e.g. 0.6 means "refresh again after 60% of the remaining time has passed".
 */
const DEFAULT_TOKEN_REFRESH_LIFETIME_FRACTION = 0.6

const INITIAL_ERROR_BACKOFF_SEC = 15
const MAX_ERROR_BACKOFF_STEP = 7

/**
 * Optional hint an `onRefresh` callback can return to let the loop schedule
 * its next run based on actual token expiration instead of a fixed interval.
 */
export interface TokenRefreshHint {
  /** ISO-8601 (or any `Date.parse`-compatible) timestamp of when the current token expires. */
  expiresAt?: string | null
}

export interface TokenRefreshLoopOptions {
  /**
   * Upper bound (in seconds) for any scheduled delay — both the
   * expiration-derived delay and the error back-off delay are capped at
   * this value. Also used as the delay when no expiration hint is
   * available. Defaults to 30 minutes, matching the original fixed-interval
   * behavior.
   */
  maxIntervalSec?: number
  /**
   * Lower bound (in seconds) for an expiration-derived delay, so an
   * about-to-expire token doesn't schedule a near-immediate refresh loop.
   * Defaults to 10 seconds.
   */
  minDelaySec?: number
  /**
   * Fraction of a token's remaining lifetime to wait before refreshing
   * again. Defaults to 0.6 (refresh once 60% of the remaining lifetime has
   * elapsed).
   */
  lifetimeFraction?: number
}

type OnRefresh = () => Promise<void | TokenRefreshHint>

const getExpirationDelaySec = (
  hint: void | TokenRefreshHint,
  maxIntervalSec: number,
  minDelaySec: number,
  lifetimeFraction: number,
): number => {
  const expiresAt = hint?.expiresAt
  if (!expiresAt) {
    return maxIntervalSec
  }

  const expiresAtMs = Date.parse(expiresAt)
  if (isNaN(expiresAtMs)) {
    return maxIntervalSec
  }

  const remainingSec = (expiresAtMs - Date.now()) / 1000
  const lifetimeBasedSec = remainingSec * lifetimeFraction

  return Math.max(minDelaySec, Math.min(maxIntervalSec, lifetimeBasedSec))
}

/**
 * Starts a background loop that periodically calls `onRefresh`, with
 * exponential back-off on failure (capped at `options.maxIntervalSec`,
 * default ~30 minutes). Stops retrying after 7 consecutive failures.
 *
 * By default (no return value from `onRefresh`, and no `options`) this
 * polls on a fixed 30-minute interval — the original behavior, unchanged.
 *
 * To opt into expiration-aware scheduling, have `onRefresh` resolve with a
 * `{ expiresAt }` hint describing when the current token expires. When
 * present and parseable, the next run is scheduled after a fraction of the
 * token's remaining lifetime (see `options.lifetimeFraction`) instead of the
 * fixed interval, clamped between `options.minDelaySec` and
 * `options.maxIntervalSec`. If the hint is absent, `null`, or unparseable,
 * the loop falls back to the fixed-interval behavior for that cycle.
 *
 * @example Existing zero-config usage (unchanged behavior)
 * ```ts
 * initTokenRefreshLoop(async () => {
 *   const { token } = await getCredentials()
 *   accessToken = token
 * })
 * ```
 *
 * @example Expiration-aware usage
 * ```ts
 * initTokenRefreshLoop(
 *   async () => {
 *     const { token, metadata } = await getCredentials()
 *     accessToken = token
 *     return { expiresAt: metadata?.expiration as string | undefined }
 *   },
 *   { maxIntervalSec: 5 * 60 },
 * )
 * ```
 */
export const initTokenRefreshLoop = (
  onRefresh: OnRefresh,
  options: TokenRefreshLoopOptions = {},
): void => {
  const maxIntervalSec = options.maxIntervalSec ?? TOKEN_REFRESH_INTERVAL_SEC
  const minDelaySec = options.minDelaySec ?? DEFAULT_MIN_REFRESH_DELAY_SEC
  const lifetimeFraction =
    options.lifetimeFraction ?? DEFAULT_TOKEN_REFRESH_LIFETIME_FRACTION

  let errorStep = 0

  const run = async () => {
    let nextTimeout: number
    try {
      const hint = await onRefresh()
      errorStep = 0
      nextTimeout = getExpirationDelaySec(
        hint,
        maxIntervalSec,
        minDelaySec,
        lifetimeFraction,
      )
    } catch {
      nextTimeout = Math.min(
        INITIAL_ERROR_BACKOFF_SEC * Math.pow(2, errorStep),
        maxIntervalSec,
      )
      if (errorStep >= MAX_ERROR_BACKOFF_STEP) return
      errorStep++
    }
    setTimeout(run, nextTimeout * 1000)
  }

  setTimeout(run, maxIntervalSec * 1000)
}

/**
 * Retrieves credentials from the Screenly OAuth service
 * @param tokenType The token endpoint type (default: 'access_token')
 * @returns An object containing the token and optional metadata from the OAuth provider
 */
export const getCredentials = async (
  tokenType: string = 'access_token',
): Promise<{ token: string; metadata?: Record<string, unknown> }> => {
  const response = await fetch(
    screenly.settings.screenly_oauth_tokens_url + tokenType + '/',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${screenly.settings.screenly_app_auth_token}`,
      },
    },
  )

  const { token, metadata } = await response.json()
  return { token, metadata }
}
