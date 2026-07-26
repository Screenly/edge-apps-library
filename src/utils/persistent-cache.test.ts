import { describe, test, expect, beforeEach } from 'vitest'
import { createPersistentCache } from './persistent-cache'

describe('createPersistentCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('returns null for a key that was never written', () => {
    const cache = createPersistentCache('test-app')
    expect(cache.read('missing')).toBeNull()
  })

  test('round-trips a written value', () => {
    const cache = createPersistentCache('test-app')
    cache.write('credentials', { accessToken: 'abc123' })
    expect(cache.read('credentials')).toEqual({ accessToken: 'abc123' })
  })

  test('namespaces keys so different caches do not collide', () => {
    const cacheA = createPersistentCache('app-a')
    const cacheB = createPersistentCache('app-b')

    cacheA.write('credentials', { accessToken: 'a' })
    cacheB.write('credentials', { accessToken: 'b' })

    expect(cacheA.read('credentials')).toEqual({ accessToken: 'a' })
    expect(cacheB.read('credentials')).toEqual({ accessToken: 'b' })
  })

  test('returns null when the stored value is not valid JSON', () => {
    const cache = createPersistentCache('test-app')
    localStorage.setItem('test-app:credentials', 'not-json')
    expect(cache.read('credentials')).toBeNull()
  })

  test('read does not throw when localStorage is unavailable', () => {
    const originalLocalStorage = globalThis.localStorage
    // @ts-expect-error simulating an environment without localStorage
    delete globalThis.localStorage

    const cache = createPersistentCache('test-app')
    expect(cache.read('credentials')).toBeNull()
    expect(() => cache.write('credentials', { accessToken: 'x' })).not.toThrow()

    globalThis.localStorage = originalLocalStorage
  })
})
