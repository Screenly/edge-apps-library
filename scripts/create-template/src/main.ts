import './style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  setupErrorHandling,
  setupTheme,
  signalReady,
} from '@screenly/edge-apps'

document.addEventListener('DOMContentLoaded', () => {
  setupErrorHandling()
  setupTheme()

  const message = getSettingWithDefault<string>('message', 'Hello, Screenly!')
  document.getElementById('message')!.textContent = message

  signalReady()
})
