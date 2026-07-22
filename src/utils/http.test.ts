import { describe, test, expect, afterEach, vi } from 'vitest'
import {
  fetchJson,
  fetchJsonOrDefault,
  FetchJsonError,
  DEFAULT_TIMEOUT_MS,
} from './http'

// eslint-disable-next-line max-lines-per-function
describe('http utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // eslint-disable-next-line max-lines-per-function
  describe('fetchJson', () => {
    test('should resolve with parsed JSON on a successful response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(JSON.stringify({ hello: 'world' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }),
      )

      const data = await fetchJson<{ hello: string }>(
        'https://example.com/data',
      )
      expect(data).toEqual({ hello: 'world' })
    })

    test('should throw a FetchJsonError when the response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response('Not Found', {
            status: 404,
            statusText: 'Not Found',
          })
        }),
      )

      await expect(fetchJson('https://example.com/missing')).rejects.toThrow(
        FetchJsonError,
      )
    })

    test('should include status, statusText, and url on a thrown FetchJsonError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response('Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
          })
        }),
      )

      try {
        await fetchJson('https://example.com/broken')
        expect.unreachable('fetchJson should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(FetchJsonError)
        const fetchError = error as FetchJsonError
        expect(fetchError.status).toBe(500)
        expect(fetchError.statusText).toBe('Internal Server Error')
        expect(fetchError.url).toBe('https://example.com/broken')
      }
    })

    test('should propagate network errors from fetch', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network error'))),
      )

      await expect(fetchJson('https://example.com/data')).rejects.toThrow(
        'Network error',
      )
    })

    test('should abort the request once timeoutMs elapses', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
        }),
      )

      await expect(
        fetchJson('https://example.com/slow', { timeoutMs: 10 }),
      ).rejects.toThrow('Aborted')
    })

    test('should apply the default timeout when timeoutMs is omitted', async () => {
      vi.useFakeTimers()
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
        }),
      )

      const result = expect(
        fetchJson('https://example.com/slow'),
      ).rejects.toThrow('Aborted')

      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
      await result

      vi.useRealTimers()
    })

    test('should not abort by the default timeout when an explicit timeoutMs overrides it', async () => {
      vi.useFakeTimers()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(JSON.stringify({ hello: 'world' }), {
            status: 200,
          })
        }),
      )

      const result = expect(
        fetchJson('https://example.com/data', {
          timeoutMs: DEFAULT_TIMEOUT_MS * 2,
        }),
      ).resolves.toEqual({ hello: 'world' })

      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS)
      await result

      vi.useRealTimers()
    })
  })

  describe('fetchJsonOrDefault', () => {
    test('should resolve with parsed JSON on a successful response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response(JSON.stringify({ hello: 'world' }), {
            status: 200,
          })
        }),
      )

      const data = await fetchJsonOrDefault<{ hello: string } | null>(
        'https://example.com/data',
        null,
      )
      expect(data).toEqual({ hello: 'world' })
    })

    test('should return the fallback and log a warning on a non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          return new Response('Not Found', { status: 404 })
        }),
      )
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const data = await fetchJsonOrDefault('https://example.com/missing', [])
      expect(data).toEqual([])
      expect(warnSpy).toHaveBeenCalledTimes(1)

      warnSpy.mockRestore()
    })

    test('should return the fallback on a network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network error'))),
      )
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const data = await fetchJsonOrDefault('https://example.com/data', null)
      expect(data).toBeNull()
    })

    test('should use a custom warning message when provided', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('Not Found', { status: 404 })),
      )
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await fetchJsonOrDefault(
        'https://example.com/missing',
        null,
        {},
        'Custom failure message:',
      )

      expect(warnSpy).toHaveBeenCalledWith(
        'Custom failure message:',
        expect.any(FetchJsonError),
      )

      warnSpy.mockRestore()
    })
  })
})
