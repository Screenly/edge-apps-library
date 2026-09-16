import { describe, test, expect } from 'vitest'
import { isLightColor } from './color'

describe('isLightColor', () => {
  describe('brightness', () => {
    test('should treat white as light and black as dark', () => {
      expect(isLightColor('#ffffff')).toBe(true)
      expect(isLightColor('#000000')).toBe(false)
    })

    test('should rank hues by perceived brightness, not raw channels', () => {
      expect(isLightColor('#ffd400')).toBe(true)
      expect(isLightColor('#0000ff')).toBe(false)
    })

    test('should treat the Screenly accent default as dark', () => {
      expect(isLightColor('#972EFF')).toBe(false)
    })

    test('should split mid greys either side of the threshold', () => {
      expect(isLightColor('#808080')).toBe(true)
      expect(isLightColor('#666666')).toBe(false)
    })
  })

  describe('formats', () => {
    test('should accept shorthand hex', () => {
      expect(isLightColor('#fff')).toBe(true)
      expect(isLightColor('#000')).toBe(false)
    })

    test('should ignore any alpha component', () => {
      expect(isLightColor('#ffffff00')).toBe(true)
      expect(isLightColor('#fff0')).toBe(true)
    })

    test('should be case insensitive', () => {
      expect(isLightColor('#FFD400')).toBe(isLightColor('#ffd400'))
    })

    test('should accept rgb and rgba strings', () => {
      expect(isLightColor('rgb(255, 255, 255)')).toBe(true)
      expect(isLightColor('rgba(0, 0, 0, 0.5)')).toBe(false)
      expect(isLightColor('rgb(255 255 255 / 50%)')).toBe(true)
    })

    test('should tolerate surrounding whitespace', () => {
      expect(isLightColor('  #ffffff  ')).toBe(true)
    })

    test('should clamp out of range channels', () => {
      expect(isLightColor('rgb(300, 300, 300)')).toBe(true)
      expect(isLightColor('rgb(-20, -20, -20)')).toBe(false)
    })
  })

  describe('invalid input', () => {
    test('should return false rather than throwing', () => {
      expect(isLightColor('')).toBe(false)
      expect(isLightColor('white')).toBe(false)
      expect(isLightColor('#12345')).toBe(false)
      expect(isLightColor('#gggggg')).toBe(false)
      expect(isLightColor('rgb(255, 255)')).toBe(false)
    })
  })
})
