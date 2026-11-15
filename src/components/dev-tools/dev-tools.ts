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
 * The Vite dev server adds this element to every page it serves and sets
 * the `dev-server` attribute, which adds a settings editor, the ready
 * signal status and a network simulator.
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
  private networkBadge!: HTMLSpanElement
  private infoSection!: HTMLDivElement
  private devServerPanel: DevServerPanel | null = null

  /**
   * Start with the panel body collapsed unless the user opened it before.
   * The dev server sets this on the element it adds.
   */
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
        <span class="info-panel__title">Edge App Dev Tools<span class="badge" hidden></span></span>
        <button type="button" class="collapse" aria-expanded="true" aria-controls="devtools-body">Hide</button>
      </div>
      <div class="info-panel__body" id="devtools-body">
        <div class="info-panel__info"></div>
        <div class="info-panel__hint">Press 'D' to toggle</div>
      </div>
    `

    this.body = this.infoPanel.querySelector('.info-panel__body')!
    this.collapseButton = this.infoPanel.querySelector('.collapse')!
    this.networkBadge = this.infoPanel.querySelector('.badge')!
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
    this.collapseButton.textContent = collapsed ? 'Show' : 'Hide'
    this.collapseButton.setAttribute('aria-expanded', String(!collapsed))
  }

  private setUpDevServer() {
    this.start()
    if (!this.devServerPanel) {
      this.devServerPanel = new DevServerPanel((mode) => this.showNetwork(mode))
      this.infoSection.after(this.devServerPanel.element)
    }
    this.devServerPanel.connect()
  }

  private showNetwork(mode: NetworkMode) {
    this.networkBadge.hidden = mode === 'online'
    this.networkBadge.textContent = mode
  }

  private updateInfo() {
    if (!this.infoSection) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const refWidth = this.referenceWidth
    const refHeight = this.referenceHeight

    this.infoSection.innerHTML = `
      <div><strong>Viewport:</strong> ${viewportWidth} × ${viewportHeight}px</div>
      <div><strong>Reference:</strong> ${refWidth} × ${refHeight}px</div>
      <div><strong>Scale:</strong> ${this.scale.toFixed(3)}</div>
      <div><strong>Orientation:</strong> ${viewportWidth >= viewportHeight ? 'Landscape' : 'Portrait'}</div>
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
