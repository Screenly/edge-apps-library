import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateScreenlyObject } from './screenly-js.ts'
import { defaultScreenlyConfig } from './screenly-config.ts'

type DevState = {
  readyAt: number | null
  readyCalls: number
  abortAt: number | null
  abortCalls: number
  network: string
}
type TestWindow = Window & {
  __screenlyDevServer?: DevState
  screenly?: { signalReadyForRendering: () => void; signalAbort?: () => void }
}

const testWindow = window as TestWindow

function runScreenlyJs() {
  new Function(generateScreenlyObject(defaultScreenlyConfig))()
}

describe('generated screenly.js', () => {
  const realFetch = window.fetch
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()
    fetchSpy = vi.fn(() => Promise.resolve(new Response('ok')))
    window.fetch = fetchSpy as unknown as typeof fetch
  })

  afterEach(() => {
    window.fetch = realFetch
    delete testWindow.__screenlyDevServer
    delete testWindow.screenly
  })

  test('records the first ready signal and dispatches screenly:ready once', () => {
    runScreenlyJs()
    const listener = vi.fn()
    window.addEventListener('screenly:ready', listener)

    testWindow.screenly!.signalReadyForRendering()
    testWindow.screenly!.signalReadyForRendering()
    window.removeEventListener('screenly:ready', listener)

    const state = testWindow.__screenlyDevServer!
    expect(state.readyAt).toEqual(expect.any(Number))
    expect(state.readyCalls).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('records skip requests and dispatches screenly:abort once', () => {
    runScreenlyJs()
    const listener = vi.fn()
    window.addEventListener('screenly:abort', listener)
    vi.spyOn(console, 'info').mockImplementation(() => {})

    testWindow.screenly!.signalAbort!()
    testWindow.screenly!.signalAbort!()
    window.removeEventListener('screenly:abort', listener)

    const state = testWindow.__screenlyDevServer!
    expect(state.abortAt).toEqual(expect.any(Number))
    expect(state.abortCalls).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('leaves fetch alone while online', () => {
    runScreenlyJs()
    expect(testWindow.__screenlyDevServer!.network).toBe('online')
    expect(window.fetch).toBe(fetchSpy)
  })

  test('offline mode rejects cross-origin requests only', async () => {
    sessionStorage.setItem('screenly-devtools:network', 'offline')
    runScreenlyJs()

    await expect(window.fetch('https://api.example.com/data')).rejects.toThrow(
      new TypeError('Failed to fetch (simulated offline)'),
    )
    await window.fetch('/__screenly/config')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(navigator.onLine).toBe(false)
  })

  test('hang mode waits until the request is aborted', async () => {
    sessionStorage.setItem('screenly-devtools:network', 'hang')
    runScreenlyJs()

    const controller = new AbortController()
    const request = window.fetch('https://api.example.com/data', {
      signal: controller.signal,
    })
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
