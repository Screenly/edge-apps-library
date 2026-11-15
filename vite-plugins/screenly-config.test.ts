import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import YAML from 'yaml'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  buildDevServerConfig,
  describeManifestSettings,
  generateMockData,
  toSettingString,
} from './screenly-config.ts'

const MANIFEST = `
syntax: manifest_v1
ready_signal: true
settings:
  state:
    type: string
    default_value: all
    title: State
    optional: true
    help_text:
      schema_version: 1
      properties:
        type: select
        display_order: 2
        help_text: Pick a state.
        options:
          - label: Everywhere
            value: all
          - label: Ohio
            value: Ohio
  display_errors:
    type: string
    default_value: 'false'
    title: Display Errors
    optional: true
    help_text:
      schema_version: 1
      properties:
        type: boolean
        advanced: true
        display_order: 1
        help_text: Show errors on screen.
  county:
    type: string
    default_value: ''
    title: County
    optional: true
    help_text: Leave blank for the whole state.
  api_key:
    type: secret
    title: API key
    optional: false
    is_global: true
    help_text: Secret key.
  legacy:
    type: other
    title: Ignored
`

describe('toSettingString', () => {
  test('turns blank YAML values into empty strings', () => {
    expect(toSettingString(null)).toBe('')
    expect(toSettingString(undefined)).toBe('')
  })

  test('stringifies YAML booleans and numbers', () => {
    expect(toSettingString(false)).toBe('false')
    expect(toSettingString(42)).toBe('42')
    expect(toSettingString('kept')).toBe('kept')
  })
})

describe('describeManifestSettings', () => {
  const fields = describeManifestSettings(YAML.parse(MANIFEST))

  test('returns no fields without a manifest', () => {
    expect(describeManifestSettings(null)).toEqual([])
  })

  test('lists string and secret settings only', () => {
    expect(fields.map((field) => field.key)).toEqual([
      'state',
      'display_errors',
      'county',
      'api_key',
    ])
  })

  test('reads select options and display order from help_text.properties', () => {
    expect(fields[0]).toMatchObject({
      key: 'state',
      title: 'State',
      input: 'select',
      default_value: 'all',
      help_text: 'Pick a state.',
      display_order: 2,
      advanced: false,
      options: [
        { label: 'Everywhere', value: 'all' },
        { label: 'Ohio', value: 'Ohio' },
      ],
    })
  })

  test('marks boolean and advanced settings', () => {
    expect(fields[1]).toMatchObject({ input: 'boolean', advanced: true })
  })

  test('falls back to the manifest type when help_text is a string', () => {
    expect(fields[2]).toMatchObject({
      input: 'string',
      help_text: 'Leave blank for the whole state.',
    })
    expect(fields[3]).toMatchObject({
      type: 'secret',
      input: 'secret',
      is_global: true,
      optional: false,
    })
  })
})

describe('generateMockData', () => {
  let rootDir: string

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-app-'))
    fs.writeFileSync(path.join(rootDir, 'screenly.yml'), MANIFEST)
  })

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  test('uses manifest defaults when there is no mock-data.yml', () => {
    const config = generateMockData(rootDir)
    expect(config.settings).toMatchObject({
      state: 'all',
      display_errors: 'false',
      county: '',
      api_key: '',
    })
    expect(config.settings).not.toHaveProperty('legacy')
  })

  test('passes blank and boolean mock values to the app as strings', () => {
    fs.writeFileSync(
      path.join(rootDir, 'mock-data.yml'),
      'settings:\n  state: Ohio\n  county:\n  display_errors: true\n',
    )
    const config = generateMockData(rootDir)
    expect(config.settings.state).toBe('Ohio')
    expect(config.settings.county).toBe('')
    expect(config.settings.display_errors).toBe('true')
  })

  test('builds the dev tools config with fields, values and metadata', () => {
    fs.writeFileSync(
      path.join(rootDir, 'mock-data.yml'),
      'metadata:\n  location: Columbus\n',
    )
    const config = buildDevServerConfig(rootDir, generateMockData(rootDir))
    expect(config.ready_signal).toBe(true)
    expect(config.settings).toHaveLength(4)
    expect(config.values.state).toBe('all')
    expect(config.metadata.location).toBe('Columbus')
  })
})
