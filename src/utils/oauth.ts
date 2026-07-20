const TOKEN_REFRESH_INTERVAL_SEC = 30 * 60

/**
 * Starts a background loop that calls `onRefresh` every 30 minutes, with
 * exponential back-off on failure (up to ~128 minutes between retries).
 * Stops retrying after 7 consecutive failures.
 */
export const initTokenRefreshLoop = (onRefresh: () => Promise<void>): void => {
  let errorStep = 0
  const initErrorDelaySec = 15
  const maxErrorStep = 7

  const run = async () => {
    let nextTimeout = TOKEN_REFRESH_INTERVAL_SEC
    try {
      await onRefresh()
      errorStep = 0
    } catch {
      nextTimeout = Math.min(
        initErrorDelaySec * Math.pow(2, errorStep),
        nextTimeout,
      )
      if (errorStep >= maxErrorStep) return
      errorStep++
    }
    setTimeout(run, nextTimeout * 1000)
  }

  setTimeout(run, TOKEN_REFRESH_INTERVAL_SEC * 1000)
}

/**
 * Retrieves credentials from the Screenly OAuth service
 * @param tokenType The token endpoint type (default: 'access_token')
 * @returns An object containing the token, optional metadata, an optional
 * error message reported by the backend, and the response status. The
 * promise still resolves (rather than rejects) for non-2xx responses, so
 * existing callers that only destructure `token`/`metadata` keep working
 * unchanged. Callers that need to distinguish a backend outage (5xx) from
 * an expected error (e.g. integration not connected) can inspect `status`.
 */
export const getCredentials = async (
  tokenType: string = 'access_token',
): Promise<{
  token?: string
  metadata?: Record<string, unknown>
  error?: string
  status: number
}> => {
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

  const body = await response.json().catch(() => ({}))
  return { ...body, status: response.status }
}
