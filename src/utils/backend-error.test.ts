import { describe, test, expect } from 'vitest'
import { BackendServerError, shouldSkipBackendError } from './backend-error'

describe('shouldSkipBackendError', () => {
  test('skips a BackendServerError when display_errors is off', () => {
    expect(shouldSkipBackendError(new BackendServerError('down'), false)).toBe(
      true,
    )
  })

  test('does not skip a BackendServerError when display_errors is on', () => {
    expect(shouldSkipBackendError(new BackendServerError('down'), true)).toBe(
      false,
    )
  })

  test('does not skip a generic Error even when display_errors is off', () => {
    expect(shouldSkipBackendError(new Error('bad config'), false)).toBe(false)
  })

  test('does not skip a non-Error value', () => {
    expect(shouldSkipBackendError('oops', false)).toBe(false)
  })
})
