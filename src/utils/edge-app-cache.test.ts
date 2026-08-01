import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { readEdgeAppCache, writeEdgeAppCache } from './edge-app-cache'

describe('edge app cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns null for a key that was never written', () => {
    expect(readEdgeAppCache('test-app', 'missing')).toBeNull()
  })

  test('round-trips a written value', () => {
    writeEdgeAppCache('test-app', 'credentials', { accessToken: 'abc123' })
    expect(readEdgeAppCache('test-app', 'credentials')).toEqual({
      accessToken: 'abc123',
    })
  })

  test('namespaces keys so different caches do not collide', () => {
    writeEdgeAppCache('app-a', 'credentials', { accessToken: 'a' })
    writeEdgeAppCache('app-b', 'credentials', { accessToken: 'b' })

    expect(readEdgeAppCache('app-a', 'credentials')).toEqual({
      accessToken: 'a',
    })
    expect(readEdgeAppCache('app-b', 'credentials')).toEqual({
      accessToken: 'b',
    })
  })

  test('returns null when the stored value is not valid JSON', () => {
    localStorage.setItem('test-app:credentials', 'not-json')
    expect(readEdgeAppCache('test-app', 'credentials')).toBeNull()
  })

  test('read does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(readEdgeAppCache('test-app', 'credentials')).toBeNull()
    expect(() =>
      writeEdgeAppCache('test-app', 'credentials', { accessToken: 'x' }),
    ).not.toThrow()
  })
})
