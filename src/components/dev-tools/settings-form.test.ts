import { describe, test, expect, afterEach } from 'vitest'
import {
  createMetadataRows,
  createSettingRows,
  groupSettingFields,
  readMetadataValues,
  readSettingValues,
  type DevServerSettingField,
} from './settings-form'

function field(
  key: string,
  overrides: Partial<DevServerSettingField> = {},
): DevServerSettingField {
  return {
    key,
    title: key,
    type: 'string',
    input: 'string',
    default_value: '',
    optional: true,
    is_global: false,
    help_text: '',
    advanced: false,
    ...overrides,
  }
}

function render(rows: HTMLElement[]): HTMLFormElement {
  const form = document.createElement('form')
  form.append(...rows)
  document.body.append(form)
  return form
}

describe('groupSettingFields', () => {
  test('orders by display_order, then manifest order, and splits advanced', () => {
    const { basic, advanced } = groupSettingFields([
      field('no_order_a'),
      field('second', { display_order: 2 }),
      field('advanced_first', { display_order: 1, advanced: true }),
      field('no_order_b'),
      field('first', { display_order: 1 }),
    ])
    expect(basic.map((f) => f.key)).toEqual([
      'first',
      'second',
      'no_order_a',
      'no_order_b',
    ])
    expect(advanced.map((f) => f.key)).toEqual(['advanced_first'])
  })
})

function useCleanBody() {
  afterEach(() => {
    document.body.innerHTML = ''
  })
}

describe('createSettingRows inputs', () => {
  useCleanBody()

  test('renders a dropdown for select settings', () => {
    const form = render(
      createSettingRows(
        [
          field('state', {
            input: 'select',
            options: [
              { label: 'Everywhere', value: 'all' },
              { label: 'Ohio', value: 'Ohio' },
            ],
          }),
        ],
        { state: 'Ohio' },
      ),
    )
    const select = form.querySelector('select')!
    expect(select.value).toBe('Ohio')
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Everywhere',
      'Ohio',
    ])
  })

  test('keeps a current value that is not one of the options', () => {
    const form = render(
      createSettingRows(
        [
          field('state', {
            input: 'select',
            options: [{ label: 'Everywhere', value: 'all' }],
          }),
        ],
        { state: 'Atlantis' },
      ),
    )
    expect(form.querySelector('select')!.value).toBe('Atlantis')
  })

  test('renders a switch for boolean settings', () => {
    const form = render(
      createSettingRows([field('display_errors', { input: 'boolean' })], {
        display_errors: 'TRUE',
      }),
    )
    const input = form.querySelector('input')!
    expect(input.type).toBe('checkbox')
    expect(input.getAttribute('role')).toBe('switch')
    expect(input.checked).toBe(true)
  })
})

describe('createSettingRows labels and values', () => {
  useCleanBody()

  test('masks secrets and labels every input', () => {
    const form = render(
      createSettingRows(
        [
          field('api_key', {
            type: 'secret',
            input: 'secret',
            title: 'API key',
            help_text: 'From the vendor.',
            is_global: true,
          }),
        ],
        { api_key: 'abc' },
      ),
    )
    const input = form.querySelector('input')!
    expect(input.type).toBe('password')
    expect(input.labels?.[0].textContent).toBe('API keyglobal')
    expect(
      document.getElementById(input.getAttribute('aria-describedby')!)!
        .textContent,
    ).toBe('From the vendor.')
  })

  test('falls back to the default value and reads values back as strings', () => {
    const form = render(
      createSettingRows(
        [
          field('county', { default_value: 'Cook' }),
          field('display_errors', { input: 'boolean' }),
        ],
        { display_errors: 'false' },
      ),
    )
    form.querySelector<HTMLInputElement>('[type="checkbox"]')!.click()
    expect(readSettingValues(form)).toEqual({
      county: 'Cook',
      display_errors: 'true',
    })
  })
})

describe('metadata rows', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('round-trip location, coordinates and tags', () => {
    const form = render(
      createMetadataRows({
        coordinates: [41.88, -87.63],
        hostname: 'dev',
        screen_name: 'Lobby',
        hardware: 'x86',
        location: 'Chicago',
        screenly_version: 'dev',
        tags: ['Lobby', 'North'],
      }),
    )
    form.querySelector<HTMLInputElement>('[name="tags"]')!.value =
      ' Lobby , , South '
    expect(readMetadataValues(form)).toEqual({
      screen_name: 'Lobby',
      location: 'Chicago',
      coordinates: [41.88, -87.63],
      tags: ['Lobby', 'South'],
    })
  })
})
