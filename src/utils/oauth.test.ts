import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { initTokenRefreshLoop } from './oauth'

const THIRTY_MIN_SEC = 30 * 60

describe('initTokenRefreshLoop > zero-arg callback (backward compatibility)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('when onRefresh succeeds, should schedule the next run on a fixed 30-minute interval', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    initTokenRefreshLoop(onRefresh)

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  test('when onRefresh fails, should back off exponentially capped at 30 minutes', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('boom'))

    initTokenRefreshLoop(onRefresh)

    // Initial call after 30 min.
    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // errorStep=0 -> 15s backoff
    await vi.advanceTimersByTimeAsync(15 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)

    // errorStep=1 -> 30s backoff
    await vi.advanceTimersByTimeAsync(30 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(3)

    // errorStep=2 -> 60s backoff
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(4)
  })

  test('when onRefresh fails 8 times in a row, should stop retrying', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('boom'))

    initTokenRefreshLoop(onRefresh)

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000) // call 1 (errorStep 0->1)
    await vi.advanceTimersByTimeAsync(15 * 1000) // call 2 (errorStep 1->2)
    await vi.advanceTimersByTimeAsync(30 * 1000) // call 3 (errorStep 2->3)
    await vi.advanceTimersByTimeAsync(60 * 1000) // call 4 (errorStep 3->4)
    await vi.advanceTimersByTimeAsync(120 * 1000) // call 5 (errorStep 4->5)
    await vi.advanceTimersByTimeAsync(240 * 1000) // call 6 (errorStep 5->6)
    await vi.advanceTimersByTimeAsync(480 * 1000) // call 7 (errorStep 6->7)
    await vi.advanceTimersByTimeAsync(960 * 1000) // call 8 (errorStep 7, at max, stops rescheduling)
    expect(onRefresh).toHaveBeenCalledTimes(8)

    // No further scheduled calls even after a long time.
    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000 * 10)
    expect(onRefresh).toHaveBeenCalledTimes(8)
  })

  test('when onRefresh recovers after a failure, should reset back-off and resume the fixed interval', async () => {
    const onRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined)

    initTokenRefreshLoop(onRefresh)

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(3)
  })
})

describe('initTokenRefreshLoop > expiration-aware callback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('when onRefresh resolves an expiresAt hint, should schedule the next run based on remaining lifetime', async () => {
    // Recomputed at call time (relative to the current, fake-timer-advanced
    // clock) so each refresh reports the same 1000s of remaining lifetime.
    const onRefresh = vi.fn().mockImplementation(async () => ({
      expiresAt: new Date(Date.now() + 1000 * 1000).toISOString(),
    }))

    initTokenRefreshLoop(onRefresh, { maxIntervalSec: THIRTY_MIN_SEC })

    // First call still happens after the initial maxIntervalSec delay
    // (there is no expiration hint before the first call).
    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // Default lifetime fraction is 0.6, so next delay ~= 600s, well under
    // the fixed 1800s interval.
    await vi.advanceTimersByTimeAsync(600 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  test('when onRefresh resolves with no hint, should fall back to the fixed interval', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    initTokenRefreshLoop(onRefresh, { maxIntervalSec: 100 })

    await vi.advanceTimersByTimeAsync(100 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(99 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  test.each([null, undefined, 'not-a-date'])(
    'when expiresAt is %s, should fall back to the fixed interval',
    async (expiresAt) => {
      const onRefresh = vi.fn().mockResolvedValue({ expiresAt })

      initTokenRefreshLoop(onRefresh, { maxIntervalSec: 100 })

      await vi.advanceTimersByTimeAsync(100 * 1000)
      expect(onRefresh).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(99 * 1000)
      expect(onRefresh).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1 * 1000)
      expect(onRefresh).toHaveBeenCalledTimes(2)
    },
  )

  test('when the token is about to expire, should clamp the delay to the configured minimum', async () => {
    const expiresAt = new Date(Date.now() + 1000).toISOString() // 1s remaining
    const onRefresh = vi.fn().mockResolvedValue({ expiresAt })

    initTokenRefreshLoop(onRefresh, {
      maxIntervalSec: THIRTY_MIN_SEC,
      minDelaySec: 20,
    })

    await vi.advanceTimersByTimeAsync(THIRTY_MIN_SEC * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // Without clamping, the lifetime-fraction delay would be ~0.6s. It
    // should instead be clamped up to minDelaySec (20s).
    await vi.advanceTimersByTimeAsync(19 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  test('when the token has a very long remaining lifetime, should clamp the delay to maxIntervalSec', async () => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24h remaining
    const onRefresh = vi.fn().mockResolvedValue({ expiresAt })

    initTokenRefreshLoop(onRefresh, { maxIntervalSec: 100 })

    await vi.advanceTimersByTimeAsync(100 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // Without clamping, the lifetime-fraction delay would be enormous
    // (~14.4h). It should instead be clamped down to maxIntervalSec (100s).
    await vi.advanceTimersByTimeAsync(99 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1 * 1000)
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })
})
