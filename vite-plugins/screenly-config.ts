import YAML from 'yaml'
import fs from 'fs'
import path from 'path'

type ScreenlyManifestField = {
  type: string
  default_value?: unknown
  title?: string
  optional?: boolean
  is_global?: boolean
  help_text?: string | Record<string, unknown>
}

export type BaseScreenlyMockData = {
  metadata: {
    coordinates: [number, number]
    hostname: string
    screen_name: string
    hardware: string
    location: string
    screenly_version: string
    tags: string[]
  }
  settings: Record<string, string>
  cors_proxy_url: string
}

export type DevServerSettingOption = { label: string; value: string }

export type DevServerSettingField = {
  key: string
  title: string
  type: string
  input: string
  default_value: string
  optional: boolean
  is_global: boolean
  help_text: string
  options?: DevServerSettingOption[]
  advanced: boolean
  display_order?: number
}

export type DevServerConfig = {
  ready_signal: boolean
  settings: DevServerSettingField[]
  values: Record<string, string>
  metadata: BaseScreenlyMockData['metadata']
}

export const defaultScreenlyConfig: BaseScreenlyMockData = {
  metadata: {
    coordinates: [37.3861, -122.0839] as [number, number],
    hostname: 'dev-hostname',
    screen_name: 'Development Server',
    hardware: 'x86',
    location: 'Development Environment',
    screenly_version: 'development-server',
    tags: ['Development'],
  },
  settings: {
    enable_analytics: 'true',
    tag_manager_id: '',
    theme: 'light',
    screenly_color_accent: '#972EFF',
    screenly_color_light: '#ADAFBE',
    screenly_color_dark: '#454BD2',
  },
  cors_proxy_url: 'http://127.0.0.1:8080',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Screenly passes every setting to the app as a string. YAML turns a blank
 * value (`county:`) into null and `false` into a boolean, so coerce them.
 */
export function toSettingString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function readManifest(rootDir: string): Record<string, unknown> | null {
  const manifestPath = path.resolve(rootDir, 'screenly.yml')
  if (!fs.existsSync(manifestPath)) {
    console.warn(`screenly.yml not found at ${manifestPath}.`)
    return null
  }
  try {
    const manifest: unknown = YAML.parse(fs.readFileSync(manifestPath, 'utf8'))
    return isPlainObject(manifest) ? manifest : null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`Failed to parse screenly.yml: ${message}.`)
    return null
  }
}

function manifestEntries(
  manifest: Record<string, unknown> | null,
): [string, ScreenlyManifestField][] {
  const settings = manifest?.settings
  if (!isPlainObject(settings)) return []
  return (
    Object.entries(settings) as [string, ScreenlyManifestField | null][]
  ).filter(
    (entry): entry is [string, ScreenlyManifestField] =>
      !!entry[1] && (entry[1].type === 'string' || entry[1].type === 'secret'),
  )
}

export function generateMockData(
  rootDir: string,
  previousConfig: BaseScreenlyMockData = defaultScreenlyConfig,
): BaseScreenlyMockData {
  const manifest = readManifest(rootDir)
  if (!manifest) {
    console.warn('Using the previous config.')
    return previousConfig
  }

  const screenlyConfig: BaseScreenlyMockData = structuredClone(
    defaultScreenlyConfig,
  )

  for (const [key, field] of manifestEntries(manifest)) {
    screenlyConfig.settings[key] = toSettingString(field.default_value)
  }

  applyMockDataOverrides(path.resolve(rootDir, 'mock-data.yml'), screenlyConfig)

  return screenlyConfig
}

function readMockData(mockDataPath: string): Record<string, unknown> | null {
  if (!fs.existsSync(mockDataPath)) return null

  // Typed as unknown since YAML.parse() can return any value (string, array, null, etc.)
  let parsedMockData: unknown
  try {
    parsedMockData = YAML.parse(fs.readFileSync(mockDataPath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(
      `Failed to parse mock-data.yml: ${message}. Keeping config without mock-data overrides.`,
    )
    return null
  }

  return isPlainObject(parsedMockData) ? parsedMockData : null
}

function applyMockDataOverrides(
  mockDataPath: string,
  screenlyConfig: BaseScreenlyMockData,
): void {
  const mockData = readMockData(mockDataPath)
  if (!mockData) return

  const { metadata, settings, cors_proxy_url } = mockData

  if (isPlainObject(metadata)) {
    Object.assign(screenlyConfig.metadata, metadata)
  }
  if (isPlainObject(settings)) {
    for (const [key, value] of Object.entries(settings)) {
      screenlyConfig.settings[key] = toSettingString(value)
    }
  }
  if (typeof cors_proxy_url === 'string' && cors_proxy_url.length > 0) {
    screenlyConfig.cors_proxy_url = cors_proxy_url
  }
}

function describeOptions(
  options: unknown,
): DevServerSettingOption[] | undefined {
  if (!Array.isArray(options)) return undefined
  return options.filter(isPlainObject).map((option) => ({
    label: toSettingString(option.label ?? option.value),
    value: toSettingString(option.value),
  }))
}

function describeField(
  key: string,
  field: ScreenlyManifestField,
): DevServerSettingField {
  const helpText = field.help_text
  const properties =
    isPlainObject(helpText) && isPlainObject(helpText.properties)
      ? helpText.properties
      : {}
  const description =
    typeof helpText === 'string' ? helpText : properties.help_text
  const fallbackInput = field.type === 'secret' ? 'secret' : 'string'

  const described: DevServerSettingField = {
    key,
    title: typeof field.title === 'string' ? field.title : key,
    type: field.type,
    input:
      typeof properties.type === 'string' ? properties.type : fallbackInput,
    default_value: toSettingString(field.default_value),
    optional: field.optional === true,
    is_global: field.is_global === true,
    help_text: typeof description === 'string' ? description.trim() : '',
    advanced: properties.advanced === true,
  }
  const options = describeOptions(properties.options)
  if (options) described.options = options
  if (typeof properties.display_order === 'number') {
    described.display_order = properties.display_order
  }
  return described
}

export function describeManifestSettings(
  manifest: Record<string, unknown> | null,
): DevServerSettingField[] {
  return manifestEntries(manifest).map(([key, field]) =>
    describeField(key, field),
  )
}

export function buildDevServerConfig(
  rootDir: string,
  config: BaseScreenlyMockData,
): DevServerConfig {
  const manifest = readManifest(rootDir)
  return {
    ready_signal: manifest?.ready_signal === true,
    settings: describeManifestSettings(manifest),
    values: { ...config.settings },
    metadata: structuredClone(config.metadata),
  }
}
