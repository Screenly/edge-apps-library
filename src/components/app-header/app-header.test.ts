import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setupScreenlyMock, resetScreenlyMock } from '../../test/mock.js'
import './app-header.js'
import '../brand-logo/brand-logo.js'

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

describe('AppHeader', () => {
  beforeEach(() => {
    setupScreenlyMock({ screen_name: 'Test Screen' })
  })

  afterEach(() => {
    resetScreenlyMock()
    document.body.innerHTML = ''
  })

  test('does not render the screen name', async () => {
    const header = document.createElement('app-header')
    document.body.appendChild(header)
    await flushMicrotasks()

    const brandLogo = header.shadowRoot!.querySelector('brand-logo')
    expect(brandLogo).not.toBeNull()
    expect(brandLogo!.hasAttribute('show-name')).toBe(false)

    await flushMicrotasks()
    const nameEl = brandLogo!.shadowRoot!.querySelector('.brand-name')
    expect(nameEl!.textContent).toBe('')
    expect(header.shadowRoot!.textContent).not.toContain('Test Screen')
  })
})
