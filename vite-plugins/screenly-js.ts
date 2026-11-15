import type { BaseScreenlyMockData } from './screenly-config.ts'

/**
 * Build the dev server's screenly.js. Besides `window.screenly`, it records
 * when the app calls `signalReadyForRendering()` and, when the dev tools
 * network simulator is on, replaces `fetch` for cross-origin requests.
 */
export function generateScreenlyObject(config: BaseScreenlyMockData): string {
  return `
    // Generated screenly.js for development mode
    window.__screenlyDevServer = (function () {
      var state = { readyAt: null, readyCalls: 0, network: 'online' }
      var mode = null
      try {
        mode = window.sessionStorage.getItem('screenly-devtools:network')
      } catch (error) {}
      if (mode !== 'offline' && mode !== 'hang') return state
      state.network = mode

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

    window.screenly = {
      signalReadyForRendering: () => {
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
  `
}
