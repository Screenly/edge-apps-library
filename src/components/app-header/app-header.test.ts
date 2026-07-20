import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setupScreenlyMock, resetScreenlyMock } from '../../test/mock.js'
import './app-header.js'
import '../brand-logo/brand-logo.js'

async function waitFor<T>(
  fn: () => T | null | undefined,
  {
    timeout = 1000,
    interval = 5,
  }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = fn()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('waitFor: timed out waiting for condition')
}

describe('AppHeader', () => {
  beforeEach(() => {
    // override_locale/override_timezone let getLocale()/getTimeZone() resolve
    // synchronously without falling back to GPS lookup or the dynamic import
    // of offline-geocode-city, keeping initialization deterministic.
    setupScreenlyMock(
      { screen_name: 'Test Screen' },
      { override_locale: 'en', override_timezone: 'UTC' },
    )
  })

  afterEach(() => {
    resetScreenlyMock()
    document.body.innerHTML = ''
  })

  test('does not render the screen name', async () => {
    const header = document.createElement('app-header')
    document.body.appendChild(header)

    const brandLogo = await waitFor(() =>
      header.shadowRoot!.querySelector('brand-logo'),
    )
    expect(brandLogo.hasAttribute('show-name')).toBe(false)

    // Wait for brand-logo's async logo-loading chain to settle before
    // asserting on .brand-name, since it exists (empty) from first render.
    await waitFor(() => brandLogo.shadowRoot?.querySelector('img[src]'))

    const nameEl = brandLogo.shadowRoot!.querySelector('.brand-name')!
    expect(nameEl.textContent).toBe('')
  })
})
