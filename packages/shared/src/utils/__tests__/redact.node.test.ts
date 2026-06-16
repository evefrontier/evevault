import { describe, expect, it } from 'vitest'
import { REDACTED, redactSensitive, SENSITIVE_FIELDS } from '../redact'

describe('redactSensitive', () => {
  it('redacts top-level sensitive fields and keeps the rest', () => {
    expect(
      redactSensitive({ pin: '123456', chain: 'sui:testnet', address: '0x1' }),
    ).toEqual({ pin: REDACTED, chain: 'sui:testnet', address: '0x1' })
  })

  it('redacts nested and array-nested sensitive fields', () => {
    expect(
      redactSensitive({
        outer: { hashedSecretKey: { iv: 'x', data: 'y' }, ok: true },
        list: [{ zkProof: { a: 1 } }, { fine: 'value' }],
      }),
    ).toEqual({
      outer: { hashedSecretKey: REDACTED, ok: true },
      list: [{ zkProof: REDACTED }, { fine: 'value' }],
    })
  })

  it('redacts OAuth token material (inherited from TOKEN_MATERIAL_FIELDS)', () => {
    expect(
      redactSensitive({
        token: { access_token: 'a' },
        refresh_token: 'r',
        id_token: 'i',
      }),
    ).toEqual({ token: REDACTED, refresh_token: REDACTED, id_token: REDACTED })
  })

  it('leaves non-sensitive structures untouched', () => {
    const input = {
      address: '0x1',
      amount: 5,
      nested: { ok: true },
      list: [1, 2],
    }
    expect(redactSensitive(input)).toEqual(input)
  })

  it('passes primitives and null through unchanged', () => {
    expect(redactSensitive('hi')).toBe('hi')
    expect(redactSensitive(42)).toBe(42)
    expect(redactSensitive(null)).toBe(null)
    expect(redactSensitive(undefined)).toBe(undefined)
  })

  it('passes non-plain objects through unchanged', () => {
    const error = new Error('boom')
    const date = new Date('2026-06-15T00:00:00.000Z')
    const url = new URL('https://example.com/path')

    expect(redactSensitive(error)).toBe(error)
    expect(redactSensitive(date)).toBe(date)
    expect(redactSensitive(url)).toBe(url)
  })

  it('covers the documented secret field names', () => {
    for (const field of [
      'pin',
      'secretKey',
      'privateKey',
      'mnemonic',
      'seed',
      'signature',
    ]) {
      expect(SENSITIVE_FIELDS.has(field)).toBe(true)
    }
  })
})
