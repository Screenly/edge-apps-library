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

const NETWORK_LABELS: Record<NetworkMode, string> = {
  online: 'Online',
  offline: 'Offline: fetch rejects',
  hang: 'Hang: fetch waits until aborted',
}

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

/**
 * Describe the ready signal for the panel.
 */
export function describeReadySignal(
  state: ScreenlyDevServerState | undefined,
  expected: boolean | null,
): string {
  if (!state) return 'unknown'
  if (state.readyAt !== null) {
    const calls = state.readyCalls > 1 ? ` (${state.readyCalls} calls)` : ''
    return `fired at ${state.readyAt} ms${calls}`
  }
  if (expected === false) return 'not called (ready_signal is off)'
  return 'not called yet'
}

const SECTION_HTML = `
  <div class="section">
    <div><strong>Ready signal:</strong> <span class="ready-status"></span></div>
    <div class="field field--stacked">
      <label for="devtools-network">Network</label>
      <select id="devtools-network" aria-describedby="devtools-network-help">
        ${Object.entries(NETWORK_LABELS)
          .map(([value, label]) => `<option value="${value}">${label}</option>`)
          .join('')}
      </select>
      <div class="field__help" id="devtools-network-help">Applies to cross-origin fetch calls. Changing it reloads the page.</div>
    </div>
  </div>
  <div class="settings section" aria-live="polite">Loading settings…</div>
`

/**
 * The dev server part of <edge-app-devtools>: ready signal status, network
 * simulator and a settings form that writes to `mock-data.yml`.
 */
export class DevServerPanel {
  readonly element: HTMLDivElement
  private readyStatus: HTMLElement
  private networkSelect: HTMLSelectElement
  private settingsHost: HTMLElement
  private config: DevServerConfig | null = null
  private loading = false
  private onReady = () => this.renderReadyStatus()

  constructor(private onNetworkChange: (mode: NetworkMode) => void) {
    this.element = document.createElement('div')
    this.element.className = 'dev-server'
    this.element.innerHTML = SECTION_HTML
    this.readyStatus = this.element.querySelector('.ready-status')!
    this.networkSelect = this.element.querySelector('#devtools-network')!
    this.settingsHost = this.element.querySelector('.settings')!

    this.networkSelect.addEventListener('change', () => {
      const mode = this.networkSelect.value as NetworkMode
      writeSession(NETWORK_STORAGE_KEY, mode === 'online' ? null : mode)
      window.location.reload()
    })
  }

  get network(): NetworkMode {
    return window.__screenlyDevServer?.network ?? 'online'
  }

  connect() {
    window.removeEventListener('screenly:ready', this.onReady)
    window.addEventListener('screenly:ready', this.onReady)
    this.networkSelect.value = this.network
    this.onNetworkChange(this.network)
    this.renderReadyStatus()
    void this.load()
  }

  disconnect() {
    window.removeEventListener('screenly:ready', this.onReady)
  }

  private async load() {
    if (this.config || this.loading) return
    this.loading = true
    try {
      this.config = await fetchDevServerConfig()
      this.renderReadyStatus()
      this.renderSettings()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.settingsHost.textContent = `Couldn't load settings: ${message}`
      this.settingsHost.classList.add('status--error')
    } finally {
      this.loading = false
    }
  }

  private renderReadyStatus() {
    this.readyStatus.textContent = describeReadySignal(
      window.__screenlyDevServer,
      this.config?.ready_signal ?? null,
    )
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
        group(
          'Advanced settings',
          createSettingRows(advanced, config.values),
          false,
        ),
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
    `
    const status = document.createElement('div')
    status.className = 'status'
    status.setAttribute('role', 'status')
    form.append(actions, status)

    form.addEventListener('reset', (event) => {
      event.preventDefault()
      this.renderSettings()
    })
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.save(form, status)
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
  summary.textContent = title
  details.append(summary, ...rows)
  return details
}
