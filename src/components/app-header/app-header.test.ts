import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupScreenlyMock, resetScreenlyMock } from '../../test/mock'
import './app-header'
import '../brand-logo/brand-logo'

describe('AppHeader', () => {
  beforeEach(() => {
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

    const brandLogo = await vi.waitUntil(() =>
      header.shadowRoot!.querySelector('brand-logo'),
    )
    expect(brandLogo.hasAttribute('show-name')).toBe(false)

    await vi.waitUntil(() => brandLogo.shadowRoot?.querySelector('img[src]'))

    const nameEl = brandLogo.shadowRoot!.querySelector('.brand-name')!
    expect(nameEl.textContent).toBe('')
  })
})
