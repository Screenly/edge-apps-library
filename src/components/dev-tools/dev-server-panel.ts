import {
  createMetadataRows,
  createSettingRows,
  fetchDevServerConfig,
  groupSettingFields,
  readMetadataValues,
  readSettingValues,
  saveDevServerConfig,
  type DevServerConfig,
} from './settings-form.js'

export type NetworkMode = 'online' | 'offline' | 'hang'

/**
 * State the dev server's screenly.js keeps on `window.__screenlyDevServer`.
 */
export interface ScreenlyDevServerState {
  /** ms after navigation start of the first `signalReadyForRendering()` call */
  readyAt: number | null
  readyCalls: number
  /** ms after navigation start of the first `signalAbort()` call */
  abortAt: number | null
  abortCalls: number
  network: NetworkMode
}

declare global {
  interface Window {
    __screenlyDevServer?: ScreenlyDevServerState
  }
}

/** sessionStorage key the dev server's screenly.js reads at page load */
export const NETWORK_STORAGE_KEY = 'screenly-devtools:network'
const RELOAD_FALLBACK_MS = 2000

export type SignalTone = 'success' | 'warning' | 'neutral'
export type SignalStatus = { text: string; tone: SignalTone }

export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {
    // Storage can be blocked; the panel still works for this page load.
  }
}

function timing(at: number, calls: number): string {
  return calls > 1 ? `${at} ms · ${calls} calls` : `${at} ms`
}

/**
 * Describe the ready signal: when the app first called it, if at all.
 */
export function describeReadySignal(
  state: ScreenlyDevServerState | undefined,
  expected: boolean | null,
): SignalStatus {
  if (!state) return { text: 'Unknown', tone: 'neutral' }
  if (state.readyAt !== null) {
    return { text: timing(state.readyAt, state.readyCalls), tone: 'success' }
  }
  if (expected === false) return { text: 'Not used', tone: 'neutral' }
  return { text: 'Waiting', tone: 'neutral' }
}

/**
 * Describe the skip signal (`signalAbort()`). A skip is a warning: on a
 * device the player would move on and the app would not be shown.
 */
export function describeSkipSignal(
  state: ScreenlyDevServerState | undefined,
): SignalStatus {
  if (!state) return { text: 'Unknown', tone: 'neutral' }
  if (state.abortAt !== null) {
    return {
      text: `Skipped · ${timing(state.abortAt, state.abortCalls)}`,
      tone: 'warning',
    }
  }
  return { text: 'Not called', tone: 'neutral' }
}

function segmented(
  name: string,
  legend: string,
  options: [string, string][],
  help: string,
): string {
  return `
    <fieldset aria-describedby="devtools-${name}-help">
      <legend>${legend}</legend>
      <div class="segmented">
        ${options
          .map(
            ([value, label]) =>
              `<label><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`,
          )
          .join('')}
      </div>
      <p class="help" id="devtools-${name}-help">${help}</p>
    </fieldset>
  `
}

const SECTION_HTML = `
  <div class="signals">
    <div class="signal">
      <span>Ready signal</span>
      <span class="pill ready-status"></span>
    </div>
    <div class="signal">
      <span>Skip signal</span>
      <span class="pill skip-status"></span>
    </div>
  </div>
  ${segmented(
    'network',
    'Network',
    [
      ['online', 'Online'],
      ['offline', 'Offline'],
      ['hang', 'Hang'],
    ],
    'Offline rejects cross-origin fetch calls. Hang keeps them pending until they are aborted. Reloads the page.',
  )}
  <div class="settings" aria-live="polite"><p class="help">Loading settings…</p></div>
`

/**
 * The dev server part of <edge-app-devtools>: ready and skip signal status,
 * network simulator, and a settings form that writes to
 * `mock-data.yml`.
 */
export class DevServerPanel {
  readonly element: HTMLDivElement
  private readyStatus: HTMLElement
  private skipStatus: HTMLElement
  private settingsHost: HTMLElement
  private config: DevServerConfig | null = null
  private loading = false
  private onSignal = () => this.renderSignals()

  constructor(private onNetworkChange: (network: NetworkMode) => void) {
    this.element = document.createElement('div')
    this.element.className = 'dev-server'
    this.element.innerHTML = SECTION_HTML
    this.readyStatus = this.element.querySelector('.ready-status')!
    this.skipStatus = this.element.querySelector('.skip-status')!
    this.settingsHost = this.element.querySelector('.settings')!

    this.element.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement
      if (input.type !== 'radio' || input.name !== 'network') return
      writeSession(
        NETWORK_STORAGE_KEY,
        input.value === 'online' ? null : input.value,
      )
      window.location.reload()
    })
  }

  connect() {
    for (const type of ['screenly:ready', 'screenly:abort']) {
      window.removeEventListener(type, this.onSignal)
      window.addEventListener(type, this.onSignal)
    }
    const state = window.__screenlyDevServer
    const network = state?.network ?? 'online'
    this.check('network', network)
    this.onNetworkChange(network)
    this.renderSignals()
    void this.load()
  }

  disconnect() {
    window.removeEventListener('screenly:ready', this.onSignal)
    window.removeEventListener('screenly:abort', this.onSignal)
  }

  private check(name: string, value: string) {
    const input = this.element.querySelector<HTMLInputElement>(
      `input[name="${name}"][value="${value}"]`,
    )
    if (input) input.checked = true
  }

  private async load() {
    if (this.config || this.loading) return
    this.loading = true
    try {
      this.config = await fetchDevServerConfig()
      this.renderSignals()
      this.renderSettings()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.settingsHost.textContent = `Couldn't load settings: ${message}`
      this.settingsHost.classList.add('status--error')
    } finally {
      this.loading = false
    }
  }

  private renderSignals() {
    const state = window.__screenlyDevServer
    const show = (element: HTMLElement, status: SignalStatus) => {
      element.textContent = status.text
      element.dataset.tone = status.tone
    }
    show(
      this.readyStatus,
      describeReadySignal(state, this.config?.ready_signal ?? null),
    )
    show(this.skipStatus, describeSkipSignal(state))
  }

  private renderSettings() {
    const config = this.config
    if (!config) return

    const { basic, advanced } = groupSettingFields(config.settings)
    const form = document.createElement('form')

    if (basic.length > 0) {
      form.append(group('Settings', createSettingRows(basic, config.values)))
    }
    if (advanced.length > 0) {
      form.append(
        group('Advanced', createSettingRows(advanced, config.values), false),
      )
    }
    form.append(
      group('Screen metadata', createMetadataRows(config.metadata), false),
    )

    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.innerHTML = `
      <button type="submit" class="primary">Save and reload</button>
      <button type="reset">Revert</button>
      <p class="status" role="status"></p>
    `
    form.append(actions)

    form.addEventListener('reset', (event) => {
      event.preventDefault()
      this.renderSettings()
    })
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.save(form, actions.querySelector('.status')!)
    })

    this.settingsHost.classList.remove('status--error')
    this.settingsHost.replaceChildren(form)
  }

  private async save(form: HTMLFormElement, status: HTMLElement) {
    if (!form.reportValidity()) return

    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!
    submit.disabled = true
    status.classList.remove('status--error')
    status.textContent = 'Saving…'

    try {
      await saveDevServerConfig({
        settings: readSettingValues(form),
        metadata: readMetadataValues(form),
      })
      status.textContent = 'Saved to mock-data.yml. Reloading…'
      // The dev server reloads the page when mock-data.yml changes.
      // Reload anyway in case its websocket isn't connected.
      window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      status.textContent = `Couldn't save: ${message}`
      status.classList.add('status--error')
      submit.disabled = false
    }
  }
}

function group(title: string, rows: HTMLElement[], open = true) {
  const details = document.createElement('details')
  details.open = open
  const summary = document.createElement('summary')
  summary.className = 'section-title'
  summary.textContent = title
  details.append(summary, ...rows)
  return details
}
