export const DEV_SERVER_CONFIG_PATH = '/__screenly/config'

export interface DevServerSettingField {
  key: string
  title: string
  type: string
  /** Editor type from `help_text.properties.type`: `select`, `boolean`, `string`, ... */
  input: string
  default_value: string
  optional: boolean
  is_global: boolean
  help_text: string
  options?: { label: string; value: string }[]
  advanced: boolean
  display_order?: number
}

export interface DevServerMetadata {
  coordinates: [number, number]
  hostname: string
  screen_name: string
  hardware: string
  location: string
  screenly_version: string
  tags: string[]
}

export interface DevServerConfig {
  ready_signal: boolean
  settings: DevServerSettingField[]
  values: Record<string, string>
  metadata: DevServerMetadata
}

export interface DevServerConfigUpdate {
  settings?: Record<string, string>
  metadata?: Partial<
    Pick<
      DevServerMetadata,
      'location' | 'coordinates' | 'tags' | 'screen_name' | 'hostname'
    >
  >
}

export function groupSettingFields(fields: DevServerSettingField[]): {
  basic: DevServerSettingField[]
  advanced: DevServerSettingField[]
} {
  const sorted = fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const orderA = a.field.display_order ?? Number.POSITIVE_INFINITY
      const orderB = b.field.display_order ?? Number.POSITIVE_INFINITY
      return orderA === orderB ? a.index - b.index : orderA - orderB
    })
    .map(({ field }) => field)

  return {
    basic: sorted.filter((field) => !field.advanced),
    advanced: sorted.filter((field) => field.advanced),
  }
}

const FIELD_ID_PREFIX = 'devtools-setting-'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props)
  element.append(...children)
  return element
}

function createInput(
  field: DevServerSettingField,
  value: string,
  id: string,
): HTMLInputElement | HTMLSelectElement {
  if (field.input === 'select' && field.options) {
    const select = el('select', { id, name: field.key })
    const options = [...field.options]
    if (!options.some((option) => option.value === value)) {
      options.unshift({ label: value === '' ? '(blank)' : value, value })
    }
    for (const option of options) {
      select.append(
        el('option', {
          value: option.value,
          textContent: option.label,
          selected: option.value === value,
        }),
      )
    }
    return select
  }

  if (field.input === 'boolean') {
    const input = el('input', {
      id,
      name: field.key,
      type: 'checkbox',
      checked: value.toLowerCase() === 'true',
    })
    input.setAttribute('role', 'switch')
    return input
  }

  return el('input', {
    id,
    name: field.key,
    type:
      field.type === 'secret' || field.input === 'secret'
        ? 'password'
        : field.input === 'number'
          ? 'number'
          : 'text',
    value,
    autocomplete: 'off',
    spellcheck: false,
    placeholder: field.default_value,
  })
}

export function createSettingRows(
  fields: DevServerSettingField[],
  values: Record<string, string>,
): HTMLDivElement[] {
  return fields.map((field) => {
    const id = `${FIELD_ID_PREFIX}${field.key}`
    const value = values[field.key] ?? field.default_value
    const input = createInput(field, value, id)
    input.dataset.settingKey = field.key
    input.dataset.input = field.input

    const label = el('label', { htmlFor: id, textContent: field.title })
    if (field.is_global) {
      label.append(el('span', { className: 'tag', textContent: 'global' }))
    }

    const row = el('div', {
      className: `field field--${field.input === 'boolean' ? 'switch' : 'stacked'}`,
    })
    row.append(label, input)

    if (field.help_text) {
      const help = el('div', {
        className: 'field__help',
        id: `${id}-help`,
        textContent: field.help_text,
      })
      input.setAttribute('aria-describedby', help.id)
      row.append(help)
    }
    return row
  })
}

export function readSettingValues(root: ParentNode): Record<string, string> {
  const values: Record<string, string> = {}
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '[data-setting-key]',
    )
    .forEach((input) => {
      const key = input.dataset.settingKey!
      values[key] =
        input instanceof HTMLInputElement && input.type === 'checkbox'
          ? String(input.checked)
          : input.value
    })
  return values
}

export function createMetadataRows(
  metadata: DevServerMetadata,
): HTMLDivElement[] {
  const row = (
    name: string,
    title: string,
    value: string,
    props: Partial<HTMLInputElement> = {},
  ) => {
    const id = `devtools-metadata-${name}`
    return el('div', { className: 'field field--stacked' }, [
      el('label', { htmlFor: id, textContent: title }),
      el('input', {
        id,
        name,
        type: 'text',
        value,
        autocomplete: 'off',
        spellcheck: false,
        ...props,
      }),
    ])
  }

  const [latitude, longitude] = metadata.coordinates ?? [0, 0]
  const coordinateProps = { type: 'number', step: 'any', required: true }
  return [
    row('screen_name', 'Screen name', metadata.screen_name ?? ''),
    row('location', 'Location', metadata.location ?? ''),
    row('latitude', 'Latitude', String(latitude), {
      ...coordinateProps,
      min: '-90',
      max: '90',
    }),
    row('longitude', 'Longitude', String(longitude), {
      ...coordinateProps,
      min: '-180',
      max: '180',
    }),
    row('tags', 'Tags (comma-separated)', (metadata.tags ?? []).join(', ')),
  ]
}

export function readMetadataValues(
  root: ParentNode,
): NonNullable<DevServerConfigUpdate['metadata']> {
  const value = (name: string) =>
    root.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? ''

  return {
    screen_name: value('screen_name'),
    location: value('location'),
    coordinates: [Number(value('latitude')), Number(value('longitude'))],
    tags: value('tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

export async function fetchDevServerConfig(): Promise<DevServerConfig> {
  const response = await fetch(DEV_SERVER_CONFIG_PATH, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Dev server returned ${response.status}`)
  }
  return (await response.json()) as DevServerConfig
}

export async function saveDevServerConfig(
  update: DevServerConfigUpdate,
): Promise<DevServerConfig> {
  const response = await fetch(DEV_SERVER_CONFIG_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  const body = (await response.json().catch(() => ({}))) as {
    error?: string
  }
  if (!response.ok) {
    throw new Error(body.error ?? `Dev server returned ${response.status}`)
  }
  return body as DevServerConfig
}
