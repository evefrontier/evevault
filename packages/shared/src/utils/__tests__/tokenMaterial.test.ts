import { describe, expect, it } from 'vitest'
import { hasNoTokenMaterial, TOKEN_MATERIAL_FIELDS } from '../tokenMaterial'

describe('hasNoTokenMaterial', () => {
  it('returns true for a primitive value', () => {
    expect(hasNoTokenMaterial('hello')).toBe(true)
    expect(hasNoTokenMaterial(42)).toBe(true)
    expect(hasNoTokenMaterial(null)).toBe(true)
    expect(hasNoTokenMaterial(undefined)).toBe(true)
  })

  it('returns true for an empty object', () => {
    expect(hasNoTokenMaterial({})).toBe(true)
  })

  it('returns true for an empty array', () => {
    expect(hasNoTokenMaterial([])).toBe(true)
  })

  it('returns true for an object with no token fields', () => {
    expect(hasNoTokenMaterial({ chain: 'sui:testnet', address: '0x1' })).toBe(
      true,
    )
  })

  it('returns false for each top-level token field', () => {
    for (const field of TOKEN_MATERIAL_FIELDS) {
      expect(hasNoTokenMaterial({ [field]: 'value' })).toBe(false)
    }
  })

  it('returns false when a token field is nested inside an object', () => {
    expect(hasNoTokenMaterial({ outer: { access_token: 'secret' } })).toBe(
      false,
    )
  })

  it('returns false when a token field is inside an array element', () => {
    expect(hasNoTokenMaterial([{ id_token: 'secret' }])).toBe(false)
  })

  it('returns true for a deeply nested object with no token fields', () => {
    expect(
      hasNoTokenMaterial({
        a: { b: { c: { d: 'safe' } } },
        list: [{ x: 1 }, { y: 'also-safe' }],
      }),
    ).toBe(true)
  })

  it('returns false when token field is at any depth in a mixed structure', () => {
    expect(
      hasNoTokenMaterial({
        meta: { count: 1 },
        payload: [{ refresh_token: 'r' }],
      }),
    ).toBe(false)
  })

  it('returns true for arrays of primitives', () => {
    expect(hasNoTokenMaterial(['a', 'b', 'c'])).toBe(true)
    expect(hasNoTokenMaterial([1, 2, 3])).toBe(true)
  })
})
