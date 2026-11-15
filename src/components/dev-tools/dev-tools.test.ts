import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import './dev-tools'
import type { EdgeAppDevToolsElement } from './dev-tools'
import {
  describeReadySignal,
  describeSkipSignal,
  NETWORK_STORAGE_KEY,
  type ScreenlyDevServerState,
} from './dev-server-panel'
import type { DevServerConfig } from './settings-form'

const config: DevServerConfig = {
  ready_signal: true,
  settings: [
    {
      key: 'state',
      title: 'State',
      type: 'string',
      input: 'select',
      default_value: 'all',
      optional: true,
      is_global: false,
      help_text: '',
      advanced: false,
      options: [
        { label: 'Everywhere', value: 'all' },
        { label: 'Ohio', value: 'Ohio' },
      ],
    },
    {
      key: 'site_id',
      title: 'Site',
      type: 'string',
      input: 'string',
      default_value: '',
      optional: true,
      is_global: false,
      help_text: '',
      advanced: true,
    },
  ],
  values: { state: 'all', site_id: '' },
  metadata: {
    coordinates: [41.88, -87.63],
    hostname: 'dev',
    screen_name: 'Lobby',
    hardware: 'x86',
    location: 'Chicago',
    screenly_version: 'dev',
    tags: ['Lobby'],
  },
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function mountWithDevServer(): Promise<EdgeAppDevToolsElement> {
  const element = document.createElement(
    'edge-app-devtools',
  ) as EdgeAppDevToolsElement
  document.body.append(element)
  element.setAttribute('dev-server', '')
  await vi.waitUntil(() => element.shadowRoot!.querySelector('form'))
  return element
}

const idle: ScreenlyDevServerState = {
  readyAt: null,
  readyCalls: 0,
  abortAt: null,
  abortCalls: 0,
  network: 'online',
}

describe('describeReadySignal', () => {
  test.each([
    [undefined, true, 'Unknown', 'neutral'],
    [{ readyAt: 812, readyCalls: 1 }, true, '812 ms', 'success'],
    [{ readyAt: 812, readyCalls: 3 }, true, '812 ms · 3 calls', 'success'],
    [{}, true, 'Waiting', 'neutral'],
    [{}, false, 'Not used', 'neutral'],
  ] as const)('%j with ready_signal %s', (state, expected, text, tone) => {
    expect(
      describeReadySignal(state && { ...idle, ...state }, expected),
    ).toEqual({ text, tone })
  })
})

describe('describeSkipSignal', () => {
  test.each([
    [undefined, 'Unknown', 'neutral'],
    [{}, 'Not called', 'neutral'],
    [{ abortAt: 1500, abortCalls: 1 }, 'Skipped · 1500 ms', 'warning'],
  ] as const)('%j', (state, text, tone) => {
    expect(describeSkipSignal(state && { ...idle, ...state })).toEqual({
      text,
      tone,
    })
  })
})

let fetchMock: ReturnType<typeof vi.fn>

function useDevServerMocks() {
  beforeEach(() => {
    sessionStorage.clear()
    window.__screenlyDevServer = { ...idle }
    fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ error: 'Unknown setting: x.' }, 400)
        : jsonResponse(config),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.__screenlyDevServer
    document.body.innerHTML = ''
  })
}

describe('<edge-app-devtools> settings form', () => {
  useDevServerMocks()

  test('renders a form from the manifest with advanced settings collapsed', async () => {
    const element = await mountWithDevServer()
    const root = element.shadowRoot!

    expect(fetchMock).toHaveBeenCalledWith('/__screenly/config', {
      headers: { Accept: 'application/json' },
    })
    const groups = [...root.querySelectorAll('details')].map((details) => [
      details.querySelector('summary')!.textContent,
      details.open,
    ])
    expect(groups).toEqual([
      ['Settings', true],
      ['Advanced', false],
      ['Screen metadata', false],
    ])
    expect(
      root.querySelector<HTMLSelectElement>('select[name="state"]')!.value,
    ).toBe('all')
  })

  test('posts the form and shows server errors', async () => {
    const element = await mountWithDevServer()
    const root = element.shadowRoot!
    root.querySelector<HTMLSelectElement>('select[name="state"]')!.value =
      'Ohio'
    root.querySelector('form')!.requestSubmit()

    await vi.waitUntil(() =>
      root.querySelector('.status')!.textContent!.startsWith("Couldn't save"),
    )
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({
      settings: { state: 'Ohio', site_id: '' },
      metadata: { location: 'Chicago', tags: ['Lobby'] },
    })
    expect(root.querySelector('.status')!.textContent).toBe(
      "Couldn't save: Unknown setting: x.",
    )
    expect(
      root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled,
    ).toBe(false)
  })
})

// eslint-disable-next-line max-lines-per-function
describe('<edge-app-devtools> dev server status and controls', () => {
  useDevServerMocks()

  test('updates the signal status when the app signals', async () => {
    const element = await mountWithDevServer()
    const root = element.shadowRoot!
    const ready = root.querySelector<HTMLElement>('.ready-status')!
    const skip = root.querySelector<HTMLElement>('.skip-status')!
    expect(ready.textContent).toBe('Waiting')
    expect(skip.textContent).toBe('Not called')

    Object.assign(window.__screenlyDevServer!, { readyAt: 640, readyCalls: 1 })
    window.dispatchEvent(new CustomEvent('screenly:ready'))
    expect(ready.textContent).toBe('640 ms')
    expect(ready.dataset.tone).toBe('success')

    Object.assign(window.__screenlyDevServer!, { abortAt: 900, abortCalls: 1 })
    window.dispatchEvent(new CustomEvent('screenly:abort'))
    expect(skip.textContent).toBe('Skipped · 900 ms')
    expect(skip.dataset.tone).toBe('warning')
  })

  test('shows a badge while the network simulator is on', async () => {
    window.__screenlyDevServer!.network = 'offline'
    const element = await mountWithDevServer()
    const root = element.shadowRoot!
    expect(
      [...root.querySelectorAll('.badge')].map((badge) => badge.textContent),
    ).toEqual(['offline'])
    const checked = [
      ...root.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked'),
    ].map((input) => input.value)
    expect(checked).toEqual(['offline'])
  })

  test('stores the network mode for the next page load', async () => {
    const element = await mountWithDevServer()
    const radio = element.shadowRoot!.querySelector<HTMLInputElement>(
      'input[name="network"][value="hang"]',
    )!
    // jsdom can't reload; the mode must be stored before it tries to.
    try {
      radio.click()
    } catch {
      // ignore jsdom's "not implemented" navigation error
    }
    expect(sessionStorage.getItem(NETWORK_STORAGE_KEY)).toBe('hang')
  })

  test('the D key toggles the panel, except while typing', async () => {
    const element = await mountWithDevServer()
    const input = element.shadowRoot!.querySelector<HTMLInputElement>(
      'input[name="site_id"]',
    )!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', bubbles: true, composed: true }),
    )
    expect(element.style.display).toBe('block')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D' }))
    expect(element.style.display).toBe('none')
  })

  test('the dev server element starts collapsed and remembers the choice', async () => {
    const element = Object.assign(
      document.createElement('edge-app-devtools') as EdgeAppDevToolsElement,
      { collapsedByDefault: true },
    )
    document.body.append(element)
    const root = element.shadowRoot!
    const button = root.querySelector<HTMLButtonElement>('.collapse')!
    expect(root.querySelector<HTMLElement>('.info-panel__body')!.hidden).toBe(
      true,
    )
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('Expand dev tools')

    button.click()
    expect(root.querySelector<HTMLElement>('.info-panel__body')!.hidden).toBe(
      false,
    )
    expect(sessionStorage.getItem('screenly-devtools:collapsed')).toBe('false')
  })
})
