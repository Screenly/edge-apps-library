// Must be imported before panic-overlay to ensure Buffer is defined at module load time.
import './buffer-shim.js'
import panic from 'panic-overlay'
import { getSettingWithDefault, signalReady } from './settings.js'

export function setupErrorHandling(): void {
  const displayErrors = getSettingWithDefault<boolean>('display_errors', false)
  panic.configure({
    handleErrors: displayErrors,
  })
  if (displayErrors) {
    window.addEventListener('error', signalReady)
    window.addEventListener('unhandledrejection', signalReady)
  }
}
