import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { installBufferShim } from './buffer-shim.js'

describe('buffer-shim', () => {
  let originalBuffer: typeof globalThis.Buffer | undefined

  beforeEach(() => {
    originalBuffer = globalThis.Buffer
    delete (globalThis as Record<string, unknown>).Buffer
  })

  afterEach(() => {
    if (originalBuffer === undefined) {
      delete (globalThis as Record<string, unknown>).Buffer
    } else {
      globalThis.Buffer = originalBuffer
    }
  })

  test('defines globalThis.Buffer when it is absent', () => {
    expect(globalThis.Buffer).toBeUndefined()

    installBufferShim()

    expect(globalThis.Buffer).toBeDefined()
    expect(typeof globalThis.Buffer.from).toBe('function')
  })

  test('does not override an existing globalThis.Buffer', () => {
    const sentinel = { sentinel: true } as unknown as typeof Buffer
    globalThis.Buffer = sentinel

    installBufferShim()

    expect(globalThis.Buffer).toBe(sentinel)
  })

  test('Buffer.from with base64 encoding returns the expected bytes', () => {
    installBufferShim()

    // "hello" in base64 is "aGVsbG8="
    const result = globalThis.Buffer.from('aGVsbG8=', 'base64')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  test('Buffer.from without encoding returns UTF-8 encoded bytes', () => {
    installBufferShim()

    const result = globalThis.Buffer.from('hi')
    expect(Array.from(result)).toEqual([104, 105])
  })
})
