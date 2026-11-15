import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import './dev-tools'
import type { EdgeAppDevToolsElement } from './dev-tools'
import { describeReadySignal, NETWORK_STORAGE_KEY } from './dev-server-panel'
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

describe('describeReadySignal', () => {
  test.each([
    [undefined, true, 'unknown'],
    [{ readyAt: 812, readyCalls: 1 }, true, 'fired at 812 ms'],
    [{ readyAt: 812, readyCalls: 3 }, true, 'fired at 812 ms (3 calls)'],
    [{ readyAt: null, readyCalls: 0 }, true, 'not called yet'],
    [
      { readyAt: null, readyCalls: 0 },
      false,
      'not called (ready_signal is off)',
    ],
  ] as const)('%j with ready_signal %s', (state, expected, text) => {
    expect(
      describeReadySignal(state && { ...state, network: 'online' }, expected),
    ).toBe(text)
  })
})

let fetchMock: ReturnType<typeof vi.fn>

function useDevServerMocks() {
  beforeEach(() => {
    sessionStorage.clear()
    window.__screenlyDevServer = {
      readyAt: null,
      readyCalls: 0,
      network: 'online',
    }
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
      ['Advanced settings', false],
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

describe('<edge-app-devtools> dev server status and controls', () => {
  useDevServerMocks()

  test('updates the ready signal status when the app signals', async () => {
    const element = await mountWithDevServer()
    const status = element.shadowRoot!.querySelector('.ready-status')!
    expect(status.textContent).toBe('not called yet')

    window.__screenlyDevServer!.readyAt = 640
    window.__screenlyDevServer!.readyCalls = 1
    window.dispatchEvent(new CustomEvent('screenly:ready'))
    expect(status.textContent).toBe('fired at 640 ms')
  })

  test('shows a badge while the network simulator is on', async () => {
    window.__screenlyDevServer!.network = 'offline'
    const element = await mountWithDevServer()
    const root = element.shadowRoot!
    expect(root.querySelector<HTMLElement>('.badge')!.hidden).toBe(false)
    expect(
      root.querySelector<HTMLSelectElement>('#devtools-network')!.value,
    ).toBe('offline')
  })

  test('stores the network mode for the next page load', async () => {
    const element = await mountWithDevServer()
    const select =
      element.shadowRoot!.querySelector<HTMLSelectElement>('#devtools-network')!
    select.value = 'hang'
    // jsdom can't reload; the mode must be stored before it tries to.
    try {
      select.dispatchEvent(new Event('change'))
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

    button.click()
    expect(root.querySelector<HTMLElement>('.info-panel__body')!.hidden).toBe(
      false,
    )
    expect(sessionStorage.getItem('screenly-devtools:collapsed')).toBe('false')
  })
})
