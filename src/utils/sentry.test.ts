import { describe, test, expect, afterEach, vi } from 'vitest'
import * as Sentry from '@sentry/browser'
import { scrubSensitiveData, setupSentry, reportError } from './sentry'
import { setupScreenlyMock, resetScreenlyMock } from '../test/mock'

vi.mock('@sentry/browser')

type SentryEvent = Parameters<typeof scrubSensitiveData>[0]

const DSN = 'https://key@sentry.example.com/1'

describe('sentry utilities', () => {
  afterEach(() => {
    resetScreenlyMock()
    vi.clearAllMocks()
  })

  describe('scrubSensitiveData', () => {
    test('when settings contain secret values, should redact them', () => {
      setupScreenlyMock(
        {},
        {
          screenly_app_auth_token: 'secret-auth',
          embed_token: 'secret-embed',
          embed_url: 'https://app.powerbi.com/visible',
        },
      )
      const event = {
        message: 'failed with secret-auth and secret-embed',
      } as SentryEvent

      const scrubbed = JSON.stringify(scrubSensitiveData(event))

      expect(scrubbed).not.toContain('secret-auth')
      expect(scrubbed).not.toContain('secret-embed')
      expect(scrubbed).toContain('[REDACTED]')
    })

    test('when settings have no secret keys, should return event unchanged', () => {
      setupScreenlyMock({}, { embed_url: 'https://app.powerbi.com/visible' })
      const event = { message: 'plain error' } as SentryEvent

      expect(scrubSensitiveData(event)).toBe(event)
    })
  })

  describe('setupSentry', () => {
    test('when no dsn is configured, should not initialize sentry', () => {
      setupScreenlyMock({}, { sentry_dsn: '' })

      setupSentry('powerbi')

      expect(Sentry.init).not.toHaveBeenCalled()
    })

    test('when dsn is configured, should tag events with app, hostname, and user', () => {
      setupScreenlyMock({ hostname: 'srly-123' }, { sentry_dsn: DSN })

      setupSentry('powerbi')

      expect(Sentry.init).toHaveBeenCalled()
      expect(Sentry.setTag).toHaveBeenCalledWith('edge_app', 'powerbi')
      expect(Sentry.setTag).toHaveBeenCalledWith('hostname', 'srly-123')
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'srly-123' })
    })

    test('when contexts are provided, should attach them', () => {
      setupScreenlyMock({}, { sentry_dsn: DSN })

      setupSentry('powerbi', { powerbi: { embed_url: 'https://report' } })

      expect(Sentry.setContext).toHaveBeenCalledWith('powerbi', {
        embed_url: 'https://report',
      })
    })
  })

  describe('reportError', () => {
    test('should capture exception with extra context', () => {
      const error = new Error('boom')

      reportError(error, { source: 'embed-token' })

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { source: 'embed-token' },
      })
    })
  })
})
