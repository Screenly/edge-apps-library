import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'http'
import { Readable } from 'stream'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  devToolsInjectionScript,
  handleConfigRequest,
  screenlyDevServer,
} from './dev-server.ts'
import { generateMockData } from './screenly-config.ts'

const MANIFEST = `
settings:
  state:
    type: string
    default_value: all
    title: State
    optional: true
    help_text: Pick a state.
`

type CapturedResponse = { status: number; body: Record<string, unknown> }

function request(
  method: string,
  body?: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  const req = Readable.from(body ? [Buffer.from(body)] : []) as Readable &
    Partial<IncomingMessage>
  req.method = method
  req.url = '/__screenly/config'
  req.headers = { host: 'localhost:5173', ...headers }
  return req as IncomingMessage
}

function response(): {
  res: ServerResponse
  done: Promise<CapturedResponse>
} {
  let resolve!: (value: CapturedResponse) => void
  const done = new Promise<CapturedResponse>((r) => (resolve = r))
  const res = {
    statusCode: 200,
    setHeader: () => res,
    end(chunk: string) {
      resolve({ status: res.statusCode, body: JSON.parse(chunk) })
    },
  }
  return { res: res as unknown as ServerResponse, done }
}

let rootDir: string
let context: Parameters<typeof handleConfigRequest>[2]

function useAppDir() {
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-app-'))
    fs.writeFileSync(path.join(rootDir, 'screenly.yml'), MANIFEST)
    let config = generateMockData(rootDir)
    context = {
      rootDir,
      getConfig: () => config,
      refreshConfig: () => {
        config = generateMockData(rootDir, config)
      },
    }
  })

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true })
  })
}

describe('handleConfigRequest', () => {
  useAppDir()

  test('GET returns the manifest fields and current values', async () => {
    const { res, done } = response()
    handleConfigRequest(request('GET'), res, context)
    const { status, body } = await done
    expect(status).toBe(200)
    expect(body.values).toMatchObject({ state: 'all' })
    expect(body.settings).toEqual([
      expect.objectContaining({ key: 'state', input: 'string' }),
    ])
  })

  test('POST writes mock-data.yml and returns the new values', async () => {
    const { res, done } = response()
    handleConfigRequest(
      request('POST', JSON.stringify({ settings: { state: 'Ohio' } }), {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      }),
      res,
      context,
    )
    const { status, body } = await done
    expect(status).toBe(200)
    expect(body.values).toMatchObject({ state: 'Ohio' })
    expect(fs.readFileSync(path.join(rootDir, 'mock-data.yml'), 'utf8')).toBe(
      'settings:\n  state: Ohio\n',
    )
  })
})

describe('handleConfigRequest refusals', () => {
  useAppDir()

  test.each([
    ['a form post', { 'content-type': 'text/plain' }],
    [
      'another origin',
      { 'content-type': 'application/json', origin: 'https://example.com' },
    ],
  ])('POST from %s is refused', async (_name, headers) => {
    const { res, done } = response()
    handleConfigRequest(
      request('POST', JSON.stringify({ settings: { state: 'Ohio' } }), headers),
      res,
      context,
    )
    expect((await done).status).toBe(403)
    expect(fs.existsSync(path.join(rootDir, 'mock-data.yml'))).toBe(false)
  })

  test('POST with an unknown setting is a 400', async () => {
    const { res, done } = response()
    handleConfigRequest(
      request('POST', JSON.stringify({ settings: { theme: 'dark' } }), {
        'content-type': 'application/json',
      }),
      res,
      context,
    )
    expect(await done).toEqual({
      status: 400,
      body: { error: 'Unknown setting: theme.' },
    })
  })

  test('other methods are a 405', async () => {
    const { res, done } = response()
    handleConfigRequest(request('DELETE'), res, context)
    expect((await done).status).toBe(405)
  })
})

describe('screenlyDevServer', () => {
  test('only runs in the dev server', () => {
    expect(screenlyDevServer().apply).toBe('serve')
  })

  test('injects the dev tools into the page', () => {
    const plugin = screenlyDevServer()
    const hook = plugin.transformIndexHtml as () => unknown[]
    expect(hook()).toEqual([
      expect.objectContaining({
        tag: 'script',
        attrs: { type: 'module' },
        injectTo: 'body',
      }),
    ])
  })

  test('the injected script reuses an existing element', () => {
    const script = devToolsInjectionScript('/lib/dev-tools.ts')
    expect(script).toContain('import "/@fs/lib/dev-tools.ts"')
    expect(script).toContain("document.querySelector('edge-app-devtools') ??")
    expect(script).toContain("devTools.setAttribute('dev-server', '')")
  })
})
