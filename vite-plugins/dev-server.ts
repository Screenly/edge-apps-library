import type { ViteDevServer, Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildDevServerConfig,
  describeManifestSettings,
  generateMockData,
  readManifest,
  type BaseScreenlyMockData,
} from './screenly-config.ts'
import {
  DEV_SERVER_CONFIG_PATH,
  isSameOriginJsonRequest,
  readBody,
  sendJson,
  validateConfigUpdate,
  writeMockDataOverrides,
} from './config-api.ts'
import { generateScreenlyObject } from './screenly-js.ts'

type ConfigRequestContext = {
  rootDir: string
  getConfig: () => BaseScreenlyMockData
  refreshConfig: () => void
}

async function handleConfigWrite(
  req: IncomingMessage,
  res: ServerResponse,
  { rootDir, getConfig, refreshConfig }: ConfigRequestContext,
): Promise<void> {
  if (!isSameOriginJsonRequest(req)) {
    sendJson(res, 403, { error: 'Send JSON from the dev server origin.' })
    return
  }

  let body: unknown
  try {
    body = JSON.parse(await readBody(req))
  } catch (error) {
    const message =
      error instanceof SyntaxError ? 'Body is not valid JSON.' : String(error)
    sendJson(res, 400, { error: message })
    return
  }

  const allowed = describeManifestSettings(readManifest(rootDir)).map(
    (field) => field.key,
  )
  const update = validateConfigUpdate(body, allowed)
  if (typeof update === 'string') {
    sendJson(res, 400, { error: update })
    return
  }

  writeMockDataOverrides(path.resolve(rootDir, 'mock-data.yml'), update)
  // The file watcher sends the full reload; refresh the config now so a
  // request that beats it already sees the new values.
  refreshConfig()
  sendJson(res, 200, buildDevServerConfig(rootDir, getConfig()))
}

/**
 * `GET /__screenly/config` returns the manifest settings, current values and
 * metadata. `POST` merges settings and metadata into `mock-data.yml`.
 */
export function handleConfigRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ConfigRequestContext,
): void {
  if (req.method === 'GET') {
    sendJson(
      res,
      200,
      buildDevServerConfig(context.rootDir, context.getConfig()),
    )
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }
  handleConfigWrite(req, res, context).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error'
    sendJson(res, 500, { error: message })
  })
}

/**
 * Where the dev tools component lives: the TypeScript source in a library
 * checkout, the compiled file in the published package.
 */
function resolveDevToolsEntry(): string | null {
  const pluginDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(pluginDir, '../src/components/dev-tools/dev-tools.ts'),
    path.resolve(pluginDir, '../dist/components/dev-tools/dev-tools.js'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

/**
 * Inline module that loads <edge-app-devtools> and turns on its dev server
 * features. Reuses the app's own element when it has one.
 */
export function devToolsInjectionScript(entry: string): string {
  const importPath = `/@fs/${entry.replace(/\\/g, '/').replace(/^\/+/, '')}`
  return `
import ${JSON.stringify(importPath)}
const devTools =
  document.querySelector('edge-app-devtools') ??
  document.body.appendChild(
    Object.assign(document.createElement('edge-app-devtools'), {
      collapsedByDefault: true,
    }),
  )
devTools.setAttribute('dev-server', '')
`
}

export function screenlyDevServer(): Plugin {
  let config: BaseScreenlyMockData
  let rootDir: string

  return {
    name: 'screenly-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      rootDir = server.config.root

      // Generate initial mock data
      config = generateMockData(rootDir)

      // Watch for changes to screenly.yml and mock-data.yml using Vite's watcher
      const manifestPath = path.resolve(rootDir, 'screenly.yml')
      const mockDataPath = path.resolve(rootDir, 'mock-data.yml')

      const handleConfigFileChange = (file: string) => {
        if (file === manifestPath || file === mockDataPath) {
          config = generateMockData(rootDir, config)
          // Notify connected clients to perform a full reload so they pick up the new mock config
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      }

      server.watcher.add([manifestPath, mockDataPath])
      server.watcher.on('add', handleConfigFileChange)
      server.watcher.on('change', handleConfigFileChange)
      server.watcher.on('unlink', handleConfigFileChange)

      const context: ConfigRequestContext = {
        rootDir,
        getConfig: () => config,
        refreshConfig: () => {
          config = generateMockData(rootDir, config)
        },
      }

      server.middlewares.use((req, res, next) => {
        if (req.url === '/screenly.js?version=1') {
          const screenlyJsContent = generateScreenlyObject(config)

          res.setHeader('Content-Type', 'application/javascript')
          res.end(screenlyJsContent)
          return
        }
        if (req.url?.split('?')[0] === DEV_SERVER_CONFIG_PATH) {
          handleConfigRequest(req, res, context)
          return
        }
        next()
      })
    },
    // Dev server only (`apply: 'serve'`), so the panel never reaches a build.
    transformIndexHtml() {
      const entry = resolveDevToolsEntry()
      if (!entry) {
        console.warn('Edge App dev tools not found; skipping the panel.')
        return []
      }
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: devToolsInjectionScript(entry),
          injectTo: 'body',
        },
      ]
    },
  }
}
