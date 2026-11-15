import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { validateConfigUpdate, writeMockDataOverrides } from './config-api.ts'

describe('validateConfigUpdate', () => {
  const allowed = ['state', 'county']

  test('accepts manifest settings and editable metadata', () => {
    const body = {
      settings: { state: 'Ohio', county: '' },
      metadata: {
        location: 'Columbus',
        coordinates: [39.96, -83],
        tags: ['Lobby'],
      },
    }
    expect(validateConfigUpdate(body, allowed)).toEqual(body)
  })

  test.each([
    [null, 'Expected a JSON object.'],
    [{ cors_proxy_url: 'x' }, 'Unknown fields: cors_proxy_url.'],
    [{ settings: { theme: 'dark' } }, 'Unknown setting: theme.'],
    [{ settings: { state: true } }, 'Setting state must be a string.'],
    [{ settings: [] }, '`settings` must be an object.'],
    [{ metadata: { hardware: 'pi' } }, 'Unknown metadata field: hardware.'],
    [
      { metadata: { coordinates: [91, 0] } },
      'coordinates must be [latitude, longitude].',
    ],
    [{ metadata: { tags: 'Lobby' } }, 'tags must be a list of strings.'],
    [{ metadata: { location: 1 } }, 'location must be a string.'],
  ])('rejects %j', (body, error) => {
    expect(validateConfigUpdate(body, allowed)).toBe(error)
  })
})

describe('writeMockDataOverrides', () => {
  let dir: string
  let mockDataPath: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-app-'))
    mockDataPath = path.join(dir, 'mock-data.yml')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('creates mock-data.yml when it does not exist', () => {
    writeMockDataOverrides(mockDataPath, { settings: { state: 'Ohio' } })
    expect(fs.readFileSync(mockDataPath, 'utf8')).toBe(
      'settings:\n  state: Ohio\n',
    )
  })

  test('keeps comments and keys the update does not touch', () => {
    fs.writeFileSync(
      mockDataPath,
      [
        '# Local overrides',
        'settings:',
        '  state: California # default for demos',
        '  county:',
        'metadata:',
        '  hostname: dev-box',
        '  tags:',
        '    - Lobby',
        '',
      ].join('\n'),
    )

    writeMockDataOverrides(mockDataPath, {
      settings: { state: 'Ohio', county: '' },
      metadata: { tags: ['Lobby', 'Ohio'], coordinates: [39.96, -83] },
    })

    expect(fs.readFileSync(mockDataPath, 'utf8')).toBe(
      [
        '# Local overrides',
        'settings:',
        '  state: Ohio # default for demos',
        '  county: ""',
        'metadata:',
        '  hostname: dev-box',
        '  tags:',
        '    - Lobby',
        '    - Ohio',
        '  coordinates:',
        '    - 39.96',
        '    - -83',
        '',
      ].join('\n'),
    )
  })

  test('refuses to overwrite a file that is not valid YAML', () => {
    fs.writeFileSync(mockDataPath, 'settings: [unclosed\n')
    expect(() =>
      writeMockDataOverrides(mockDataPath, { settings: { state: 'Ohio' } }),
    ).toThrow('mock-data.yml is not valid YAML')
    expect(fs.readFileSync(mockDataPath, 'utf8')).toBe('settings: [unclosed\n')
  })
})
