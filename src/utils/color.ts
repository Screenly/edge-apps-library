type Rgb = [number, number, number]

/**
 * Relative luminance at which text contrast against black and against white
 * is equal. Colors above it read better with dark text, colors below it with
 * light text.
 */
const LIGHT_THRESHOLD = 0.179

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value))
}

function parseHex(color: string): Rgb | null {
  const digits = color.slice(1)
  const expanded =
    digits.length === 3 || digits.length === 4
      ? digits.replace(/./g, (digit) => digit + digit)
      : digits

  if (expanded.length !== 6 && expanded.length !== 8) return null
  if (!/^[0-9a-f]+$/i.test(expanded)) return null

  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ]
}

function parseRgb(color: string): Rgb | null {
  const match = color.match(/^rgba?\(([^)]+)\)$/i)
  if (!match) return null

  const channels = match[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number)

  if (channels.length !== 3 || channels.some(Number.isNaN)) return null

  return [
    clampChannel(channels[0]),
    clampChannel(channels[1]),
    clampChannel(channels[2]),
  ]
}

function parseColor(color: string): Rgb | null {
  const value = color.trim()
  if (value.startsWith('#')) return parseHex(value)
  return parseRgb(value)
}

function toLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  )
}

/**
 * Check whether a color is light enough to need dark text on top of it.
 *
 * Uses the WCAG relative luminance formula rather than raw RGB averages, so
 * hues of the same nominal brightness are ranked the way an eye ranks them.
 * Accepts hex (`#abc`, `#aabbcc`, `#aabbccdd`) and numeric `rgb()` / `rgba()`
 * strings; any alpha component is ignored. Percentage channels and named
 * colors are not supported.
 *
 * Returns `false` for values it cannot parse, so an unattended screen keeps
 * rendering instead of throwing on a malformed setting.
 */
export function isLightColor(color: string): boolean {
  const rgb = parseColor(color)
  if (!rgb) return false

  return getRelativeLuminance(rgb) > LIGHT_THRESHOLD
}
