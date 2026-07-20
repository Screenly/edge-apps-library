import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCredentials } from './oauth.js'
import { setupScreenlyMock, resetScreenlyMock } from '../test/mock'

const OAUTH_SETTINGS = {
  screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
  screenly_app_auth_token: 'app-auth',
}

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    status,
    json: async () => body,
  })) as unknown as typeof fetch
}

describe('getCredentials', () => {
  beforeEach(() => {
    setupScreenlyMock({}, OAUTH_SETTINGS)
  })

  afterEach(() => {
    resetScreenlyMock()
    vi.unstubAllGlobals()
  })

  test('resolves with the token, metadata, and status on success', async () => {
    globalThis.fetch = fakeFetch(200, {
      token: 'abc',
      metadata: { instance_url: 'https://na1.salesforce.com' },
    })

    const result = await getCredentials()

    expect(result).toEqual({
      token: 'abc',
      metadata: { instance_url: 'https://na1.salesforce.com' },
      status: 200,
    })
  })

  test('resolves rather than rejects on a non-2xx response, surfacing the status and error', async () => {
    globalThis.fetch = fakeFetch(400, {
      error: 'Salesforce integration is not connected',
    })

    const result = await getCredentials()

    expect(result).toEqual({
      error: 'Salesforce integration is not connected',
      status: 400,
    })
    expect(result.token).toBeUndefined()
  })

  test('resolves with just a status when a 5xx response has no body', async () => {
    globalThis.fetch = fakeFetch(503, undefined)

    const result = await getCredentials()

    expect(result.status).toBe(503)
    expect(result.token).toBeUndefined()
  })

  test('falls back to an empty body when the response is not JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })) as unknown as typeof fetch

    const result = await getCredentials()

    expect(result).toEqual({ status: 502 })
  })

  test('requests the given token type', async () => {
    const fetchMock = fakeFetch(200, { token: 'abc' })
    globalThis.fetch = fetchMock

    await getCredentials('embed_token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/oauth/embed_token/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer app-auth',
        }),
      }),
    )
  })
})
