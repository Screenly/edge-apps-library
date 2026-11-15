import type { IncomingMessage, ServerResponse } from 'http'
import YAML from 'yaml'
import fs from 'fs'
import type { BaseScreenlyMockData } from './screenly-config.ts'

export const DEV_SERVER_CONFIG_PATH = '/__screenly/config'
const MAX_BODY_BYTES = 1024 * 1024

type EditableMetadata = Pick<
  BaseScreenlyMockData['metadata'],
  'location' | 'coordinates' | 'tags' | 'screen_name' | 'hostname'
>

export type DevServerConfigUpdate = {
  settings?: Record<string, string>
  metadata?: Partial<EditableMetadata>
}

type Validated<T> = { value: T } | { error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validateSettings(
  settings: unknown,
  allowedSettings: string[],
): Validated<Record<string, string>> {
  if (!isPlainObject(settings))
    return { error: '`settings` must be an object.' }
  const allowed = new Set(allowedSettings)
  const value: Record<string, string> = {}
  for (const [key, setting] of Object.entries(settings)) {
    if (!allowed.has(key)) return { error: `Unknown setting: ${key}.` }
    if (typeof setting !== 'string') {
      return { error: `Setting ${key} must be a string.` }
    }
    value[key] = setting
  }
  return { value }
}

function isCoordinates(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(value[0]) <= 90 &&
    Math.abs(value[1]) <= 180
  )
}

function validateMetadataField(
  key: string,
  value: unknown,
): string | undefined {
  switch (key) {
    case 'location':
    case 'screen_name':
    case 'hostname':
      return typeof value === 'string' ? undefined : `${key} must be a string.`
    case 'coordinates':
      return isCoordinates(value)
        ? undefined
        : 'coordinates must be [latitude, longitude].'
    case 'tags':
      return Array.isArray(value) && value.every((t) => typeof t === 'string')
        ? undefined
        : 'tags must be a list of strings.'
    default:
      return `Unknown metadata field: ${key}.`
  }
}

function validateMetadata(
  metadata: unknown,
): Validated<Partial<EditableMetadata>> {
  if (!isPlainObject(metadata))
    return { error: '`metadata` must be an object.' }
  for (const [key, value] of Object.entries(metadata)) {
    const error = validateMetadataField(key, value)
    if (error) return { error }
  }
  return { value: metadata as Partial<EditableMetadata> }
}

export function validateConfigUpdate(
  body: unknown,
  allowedSettings: string[],
): DevServerConfigUpdate | string {
  if (!isPlainObject(body)) return 'Expected a JSON object.'
  const { settings, metadata, ...rest } = body
  const unknownKeys = Object.keys(rest)
  if (unknownKeys.length > 0) {
    return `Unknown fields: ${unknownKeys.join(', ')}.`
  }

  const update: DevServerConfigUpdate = {}
  if (settings !== undefined) {
    const result = validateSettings(settings, allowedSettings)
    if ('error' in result) return result.error
    update.settings = result.value
  }
  if (metadata !== undefined) {
    const result = validateMetadata(metadata)
    if ('error' in result) return result.error
    update.metadata = result.value
  }
  return update
}

export function writeMockDataOverrides(
  mockDataPath: string,
  update: DevServerConfigUpdate,
): void {
  const source = fs.existsSync(mockDataPath)
    ? fs.readFileSync(mockDataPath, 'utf8')
    : ''
  const parsed = YAML.parseDocument(source)
  if (parsed.errors.length > 0) {
    throw new Error(
      `mock-data.yml is not valid YAML: ${parsed.errors[0].message}`,
    )
  }
  const doc = YAML.isMap(parsed.contents) ? parsed : new YAML.Document({})

  for (const [section, values] of Object.entries(update)) {
    if (!values) continue
    if (!YAML.isMap(doc.get(section))) doc.set(section, doc.createNode({}))
    for (const [key, value] of Object.entries(values)) {
      const existing = doc.getIn([section, key], true)
      if (YAML.isScalar(existing) && !Array.isArray(value)) {
        // Updating in place keeps the comment on that line
        existing.value = value
      } else {
        doc.setIn([section, key], doc.createNode(value))
      }
    }
  }

  fs.writeFileSync(mockDataPath, doc.toString())
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Block cross-site writes: browsers send a preflight for JSON bodies, and a
 * page on another origin can't make its Origin match this server's host.
 */
export function isSameOriginJsonRequest(req: IncomingMessage): boolean {
  const contentType = req.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) return false
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}
