import { devToolsStyles } from './dev-tools.styles.js'
import {
  DevServerPanel,
  readSession,
  writeSession,
  type NetworkMode,
} from './dev-server-panel.js'

export type { NetworkMode, ScreenlyDevServerState } from './dev-server-panel.js'

const COLLAPSED_STORAGE_KEY = 'screenly-devtools:collapsed'

function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0]
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

/**
 * <edge-app-devtools>
 *
 * Development overlay showing viewport, reference resolution, and scale.
 * Intended to be used alongside <auto-scaler>. Listens for the
 * `scalechange` event dispatched by the scaler.
 *
 * Usage:
 * ```html
 * <auto-scaler reference-width="1920" reference-height="1080">
 *   <!-- app content -->
 * </auto-scaler>
 * <edge-app-devtools reference-width="1920" reference-height="1080"></edge-app-devtools>
 * ```
 */
export class EdgeAppDevToolsElement extends HTMLElement {
  private infoPanel!: HTMLDivElement
  private isVisible = false
  private scale = 1
  private started = false
  private body!: HTMLDivElement
  private collapseButton!: HTMLButtonElement
  private badges!: HTMLSpanElement
  private infoSection!: HTMLElement
  private devServerPanel: DevServerPanel | null = null

  public collapsedByDefault = false

  private boundOnResize = () => this.updateInfo()
  private boundOnKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'd' && event.key !== 'D') return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isTypingTarget(event)) return
    this.toggle()
  }
  private boundOnScaleChange = (event: Event) => {
    const detail = (event as CustomEvent<{ scale: number }>).detail
    if (detail && typeof detail.scale === 'number') {
      this.updateScale(detail.scale)
    }
  }

  static get observedAttributes() {
    return ['reference-width', 'reference-height', 'dev-server']
  }

  constructor() {
    super()

    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = devToolsStyles

    this.infoPanel = document.createElement('div')
    this.infoPanel.className = 'info-panel'
    this.infoPanel.innerHTML = `
      <div class="info-panel__header">
        <span class="info-panel__title">Edge App dev tools<span class="badges"></span></span>
        <button type="button" class="collapse" aria-expanded="true" aria-controls="devtools-body" aria-label="Collapse dev tools">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5"/></svg>
        </button>
      </div>
      <div class="info-panel__body" id="devtools-body">
        <dl class="stats info-panel__info"></dl>
        <p class="info-panel__hint">Press <kbd>D</kbd> to show or hide this panel</p>
      </div>
    `

    this.body = this.infoPanel.querySelector('.info-panel__body')!
    this.collapseButton = this.infoPanel.querySelector('.collapse')!
    this.badges = this.infoPanel.querySelector('.badges')!
    this.infoSection = this.infoPanel.querySelector('.info-panel__info')!

    this.collapseButton.addEventListener('click', () => {
      const collapsed = !this.body.hidden
      this.setCollapsed(collapsed)
      writeSession(COLLAPSED_STORAGE_KEY, String(collapsed))
    })

    shadow.append(style, this.infoPanel)
  }

  connectedCallback() {
    this.upgradeProperty('referenceWidth')
    this.upgradeProperty('referenceHeight')

    if (!this.isDevelopmentMode() && !this.hasAttribute('dev-server')) {
      // In production we keep the element present but hidden
      this.hide()
      return
    }

    this.start()
    if (this.hasAttribute('dev-server')) this.setUpDevServer()
  }

  disconnectedCallback() {
    this.started = false
    window.removeEventListener('resize', this.boundOnResize)
    window.removeEventListener('keydown', this.boundOnKeyDown)
    this.devServerPanel?.disconnect()
    document.removeEventListener(
      'scalechange',
      this.boundOnScaleChange as EventListener,
    )
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    if (!this.isConnected) return
    if (name === 'dev-server') {
      if (this.hasAttribute('dev-server')) this.setUpDevServer()
      return
    }
    this.updateInfo()
  }

  private isDevelopmentMode(): boolean {
    const meta = import.meta as { env?: { DEV?: boolean } }
    return (
      meta.env?.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.search.includes('dev=true')
    )
  }

  private upgradeProperty(prop: string) {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      const element = this as unknown as Record<string, unknown>
      const value = element[prop]

      delete element[prop]
      element[prop] = value
    }
  }

  private get referenceWidth(): number {
    const attr = this.getAttribute('reference-width')
    const value = attr ? Number(attr) : 1920
    return Number.isFinite(value) ? value : 1920
  }

  private get referenceHeight(): number {
    const attr = this.getAttribute('reference-height')
    const value = attr ? Number(attr) : 1080
    return Number.isFinite(value) ? value : 1080
  }

  private start() {
    if (this.started) return
    this.started = true

    window.addEventListener('resize', this.boundOnResize)
    window.addEventListener('keydown', this.boundOnKeyDown)

    // Listen for scalechange events from <auto-scaler> elements
    // Events bubble up to document level, so we can listen there
    // This works whether auto-scaler is a parent or sibling
    document.addEventListener(
      'scalechange',
      this.boundOnScaleChange as EventListener,
    )

    const stored = readSession(COLLAPSED_STORAGE_KEY)
    this.setCollapsed(
      stored === null ? this.collapsedByDefault : stored === 'true',
    )
    this.show()
    this.updateInfo()
  }

  private setCollapsed(collapsed: boolean) {
    this.body.hidden = collapsed
    this.collapseButton.setAttribute('aria-expanded', String(!collapsed))
    this.collapseButton.setAttribute(
      'aria-label',
      collapsed ? 'Expand dev tools' : 'Collapse dev tools',
    )
  }

  private setUpDevServer() {
    this.start()
    if (!this.devServerPanel) {
      this.devServerPanel = new DevServerPanel((network) =>
        this.showNetwork(network),
      )
      this.infoSection.after(this.devServerPanel.element)
    }
    this.devServerPanel.connect()
  }

  private showNetwork(network: NetworkMode) {
    this.badges.replaceChildren(
      ...(network === 'online'
        ? []
        : [
            Object.assign(document.createElement('span'), {
              className: 'badge',
              textContent: network,
            }),
          ]),
    )
  }

  private updateInfo() {
    if (!this.infoSection) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const refWidth = this.referenceWidth
    const refHeight = this.referenceHeight

    this.infoSection.innerHTML = `
      <div><dt>Viewport</dt><dd>${viewportWidth} × ${viewportHeight}</dd></div>
      <div><dt>Reference</dt><dd>${refWidth} × ${refHeight}</dd></div>
      <div><dt>Scale</dt><dd>${this.scale.toFixed(3)}</dd></div>
      <div><dt>Orientation</dt><dd>${viewportWidth >= viewportHeight ? 'Landscape' : 'Portrait'}</dd></div>
    `
  }

  /**
   * Toggle visibility of dev tools.
   * Does not dispatch events in response to host setting properties,
   * in line with best practices.
   */
  public toggle() {
    this.isVisible = !this.isVisible
    this.style.display = this.isVisible ? 'block' : 'none'
  }

  public show() {
    this.isVisible = true
    this.style.display = 'block'
  }

  public hide() {
    this.isVisible = false
    this.style.display = 'none'
  }

  /**
   * Imperative API for AutoScaler or host code to update the scale.
   * Prefer listening to `scalechange` events on <auto-scaler>,
   * but this method is provided for compatibility.
   */
  public updateScale(scale: number) {
    this.scale = scale
    this.updateInfo()
  }
}

// Register the custom element
if (typeof window !== 'undefined' && !customElements.get('edge-app-devtools')) {
  customElements.define('edge-app-devtools', EdgeAppDevToolsElement)
}
