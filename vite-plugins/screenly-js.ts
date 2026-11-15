import type { BaseScreenlyMockData } from './screenly-config.ts'

// Dev tools state, read from sessionStorage, plus the network simulator.
const DEV_SERVER_STATE = `
    window.__screenlyDevServer = (function () {
      var read = function (key) {
        try {
          return window.sessionStorage.getItem(key)
        } catch (error) {
          return null
        }
      }
      var mode = read('screenly-devtools:network')
      var state = {
        readyAt: null,
        readyCalls: 0,
        abortAt: null,
        abortCalls: 0,
        network: mode === 'offline' || mode === 'hang' ? mode : 'online',
        player: read('screenly-devtools:player') === 'legacy' ? 'legacy' : 'current'
      }
      if (state.network === 'online') return state

      // Simulate a device without a network: cross-origin requests fail,
      // while the app's own files and the dev server keep working.
      var realFetch = window.fetch.bind(window)
      var abortError = function (signal) {
        return signal.reason !== undefined
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError')
      }
      window.fetch = function (input, init) {
        var url = input instanceof Request ? input.url : String(input)
        if (new URL(url, window.location.href).origin === window.location.origin) {
          return realFetch(input, init)
        }
        var signal = (init && init.signal) || (input instanceof Request ? input.signal : null)
        if (signal && signal.aborted) return Promise.reject(abortError(signal))
        if (mode === 'offline') {
          return Promise.reject(new TypeError('Failed to fetch (simulated offline)'))
        }
        return new Promise(function (_resolve, reject) {
          if (!signal) return
          signal.addEventListener('abort', function () {
            reject(abortError(signal))
          }, { once: true })
        })
      }
      if (mode === 'offline') {
        try {
          Object.defineProperty(window.navigator, 'onLine', { get: function () { return false } })
        } catch (error) {}
      }
      return state
    })()
`

// signalAbort() exists on ScreenlyOS 26.9+ only, so it is optional here too.
const SIGNAL_ABORT = `
    if (window.__screenlyDevServer.player === 'current') {
      // On a device the player moves on to the next playlist item.
      window.screenly.signalAbort = function () {
        var state = window.__screenlyDevServer
        state.abortCalls += 1
        if (state.abortAt === null) {
          state.abortAt = Math.round(performance.now())
          console.info('[dev server] The app asked the player to skip it (signalAbort).')
          window.dispatchEvent(new CustomEvent('screenly:abort', { detail: { abortAt: state.abortAt } }))
        }
      }
    }
`

/**
 * Build the dev server's screenly.js. Besides `window.screenly`, it records
 * when the app calls `signalReadyForRendering()` and `signalAbort()`, and,
 * when the dev tools network simulator is on, replaces `fetch` for
 * cross-origin requests.
 *
 * `signalAbort()` exists on ScreenlyOS 26.9 and later only, so it is left
 * out when the dev tools simulate an older player or a browser.
 */
export function generateScreenlyObject(config: BaseScreenlyMockData): string {
  return `
    // Generated screenly.js for development mode
${DEV_SERVER_STATE}
    window.screenly = {
      signalReadyForRendering: function () {
        var state = window.__screenlyDevServer
        state.readyCalls += 1
        if (state.readyAt === null) {
          state.readyAt = Math.round(performance.now())
          window.dispatchEvent(new CustomEvent('screenly:ready', { detail: { readyAt: state.readyAt } }))
        }
      },
      metadata: ${JSON.stringify(config.metadata, null, 2)},
      settings: ${JSON.stringify(config.settings, null, 2)},
      cors_proxy_url: ${JSON.stringify(config.cors_proxy_url)}
    }

${SIGNAL_ABORT}
  `
}
