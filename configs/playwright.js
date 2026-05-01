/* global process */
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const PREVIEW_PORT = 4173

const appRequire = createRequire(path.join(process.cwd(), 'package.json'))

let defineConfig
let devices

try {
  const playwrightTest = appRequire('@playwright/test')
  defineConfig = playwrightTest.defineConfig
  devices = playwrightTest.devices
} catch {
  throw new Error(
    "Failed to resolve '@playwright/test' from the application. " +
      "Please install it in your app (e.g. 'npm install -D @playwright/test') " +
      'and try again.',
  )
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libraryRoot = path.dirname(__dirname)
const appViteBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'vite')
const viteBin = existsSync(appViteBin)
  ? appViteBin
  : path.resolve(libraryRoot, 'node_modules', '.bin', 'vite')
const viteConfig = path.resolve(libraryRoot, 'vite.config.ts')

export default defineConfig({
  testDir: path.join(process.cwd(), 'e2e'),
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `"${viteBin}" build --config "${viteConfig}" && "${viteBin}" preview --config "${viteConfig}" --port ${PREVIEW_PORT} --strictPort`,
    cwd: process.cwd(),
    port: PREVIEW_PORT,
    reuseExistingServer: false,
  },
})
