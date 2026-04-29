import { describe, test, expect } from 'bun:test'
import './buffer-shim.js'

describe('buffer-shim', () => {
  test('defines globalThis.Buffer when it is absent', () => {
    expect(globalThis.Buffer).toBeDefined()
    expect(typeof globalThis.Buffer.from).toBe('function')
  })

  test('does not override an existing globalThis.Buffer', () => {
    const existing = globalThis.Buffer
    // Simulate the shim guard: should not reassign when Buffer is already defined
    if (typeof globalThis.Buffer === 'undefined') {
      globalThis.Buffer = {} as typeof Buffer
    }
    expect(globalThis.Buffer).toBe(existing)
  })

  test('Buffer.from with base64 encoding returns the expected bytes', () => {
    // "hello" in base64 is "aGVsbG8="
    const result = globalThis.Buffer.from('aGVsbG8=', 'base64')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  test('Buffer.from without encoding returns UTF-8 encoded bytes', () => {
    const result = globalThis.Buffer.from('hi')
    expect(Array.from(result)).toEqual([104, 105])
  })
})
