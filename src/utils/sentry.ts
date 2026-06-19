import * as Sentry from '@sentry/browser'
import type { ErrorEvent } from '@sentry/browser'
import { getHostname } from './metadata.js'
import { getSetting, getSettings } from './settings.js'

const SENSITIVE_KEY_PATTERNS = ['token', 'secret', 'password', 'credential']

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern))
}

export function scrubSensitiveData(event: ErrorEvent): ErrorEvent {
  const settings = getSettings()
  const secrets = Object.keys(settings)
    .filter(isSensitiveKey)
    .map((key) => settings[key])
    .filter(
      (value): value is string => typeof value === 'string' && value !== '',
    )

  if (secrets.length === 0) {
    return event
  }

  let serialized = JSON.stringify(event)
  for (const secret of secrets) {
    serialized = serialized.split(secret).join('[REDACTED]')
  }
  return JSON.parse(serialized) as ErrorEvent
}

export function setupSentry(
  app: string,
  contexts: Record<string, Record<string, unknown>> = {},
): void {
  const dsn = getSetting<string>('sentry_dsn')
  if (!dsn) {
    return
  }

  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      beforeSend: scrubSensitiveData,
    })
    Sentry.setTag('edge_app', app)
    Sentry.setTag('hostname', getHostname())
    Sentry.setUser({ id: getHostname() })
    for (const [name, data] of Object.entries(contexts)) {
      Sentry.setContext(name, data)
    }
  } catch (error) {
    console.error('Sentry init failed', error)
  }
}

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  Sentry.captureException(error, { extra: context })
}
