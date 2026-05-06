import { JSDOM } from 'jsdom'

// Preserve the side-effect import contract of `@screenly/edge-apps/test`
// for downstream Bun tests that need DOM globals.
const dom = new JSDOM(
  '<!DOCTYPE html><html><head></head><body></body></html>',
  {
    url: 'http://localhost',
  },
)

global.document = dom.window.document
global.window = dom.window as unknown as Window & typeof globalThis
global.navigator = dom.window.navigator
global.Node = dom.window.Node
global.HTMLElement = dom.window.HTMLElement
global.customElements = dom.window.customElements
global.getComputedStyle = dom.window.getComputedStyle
global.SVGSVGElement = dom.window.SVGSVGElement

export * from './mock.js'
