import { JSDOM } from 'jsdom'

// Preserve the side-effect import contract of `@screenly/edge-apps/test`
// for downstream Bun tests that need DOM globals.
const g = globalThis as typeof globalThis & {
  Node?: typeof Node
  HTMLElement?: typeof HTMLElement
  SVGSVGElement?: typeof SVGSVGElement
  customElements?: typeof customElements
  navigator?: Navigator
  getComputedStyle?: typeof getComputedStyle
}

if (typeof g.window === 'undefined' || typeof g.document === 'undefined') {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body></body></html>',
    {
      url: 'http://localhost',
    },
  )

  g.window = dom.window as unknown as Window & typeof globalThis
  g.document = dom.window.document
  g.navigator = dom.window.navigator
  g.Node = dom.window.Node
  g.HTMLElement = dom.window.HTMLElement
  g.customElements = dom.window.customElements
  g.getComputedStyle = dom.window.getComputedStyle
  g.SVGSVGElement = dom.window.SVGSVGElement
}

export * from './mock.js'
