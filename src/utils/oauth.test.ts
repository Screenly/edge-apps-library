import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCredentials } from './oauth'
import { setupScreenlyMock, resetScreenlyMock } from '../test/mock'

// eslint-disable-next-line max-lines-per-function
describe('oauth utilities', () => {
  beforeEach(() => {
    setupScreenlyMock(
      {},
      {
        screenly_oauth_tokens_url: 'https://example.com/oauth/tokens/',
        screenly_app_auth_token: 'secret-auth',
      },
    )
  })

  afterEach(() => {
    resetScreenlyMock()
    vi.unstubAllGlobals()
  })

  // eslint-disable-next-line max-lines-per-function
  describe('getCredentials', () => {
    test('should return token, expiration, and metadata when all are present', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              token: 'test-token',
              expiration: '2024-06-01T11:00:00Z',
              metadata: { scope: 'read' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
      )

      const result = await getCredentials()

      expect(result).toEqual({
        token: 'test-token',
        expiration: '2024-06-01T11:00:00Z',
        metadata: { scope: 'read' },
      })
    })

    test('should handle a null expiration without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              token: 'test-token',
              expiration: null,
              metadata: { scope: 'read' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
      )

      const result = await getCredentials()

      expect(result.expiration).toBeNull()
      expect(result.token).toBe('test-token')
    })

    test('should handle a missing expiration without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              token: 'test-token',
              metadata: { scope: 'read' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
      )

      const result = await getCredentials()

      expect(result.expiration).toBeUndefined()
      expect(result.token).toBe('test-token')
      expect(result.metadata).toEqual({ scope: 'read' })
    })

    test('should use the provided token type in the request URL', async () => {
      const fetchMock = vi.fn(async () => {
        return new Response(
          JSON.stringify({ token: 'refresh-token', expiration: null }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      })
      vi.stubGlobal('fetch', fetchMock)

      await getCredentials('refresh_token')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/oauth/tokens/refresh_token/',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-auth',
          }),
        }),
      )
    })

    test('should return metadata as undefined when absent from the response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(
            JSON.stringify({
              token: 'test-token',
              expiration: '2024-06-01T11:00:00Z',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
      )

      const result = await getCredentials()

      expect(result.metadata).toBeUndefined()
    })
  })
})
