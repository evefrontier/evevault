import { afterEach, describe, expect, it, vi } from 'vitest'

const errorMock = vi.hoisted(() => vi.fn())

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    error: errorMock,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { makeJwt } from '#/testing'
import { deriveEncryptionKey } from '#/utils/keys/deriveEncryptionKey'

describe('deriveEncryptionKey', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('derives "sub:tid:email" from a valid token payload', () => {
    const token = makeJwt({
      sub: 'user-123',
      tid: 'tenant-abc',
      email: 'user@example.com',
    })
    expect(deriveEncryptionKey(token)).toBe(
      'user-123:tenant-abc:user@example.com',
    )
  })

  it('is deterministic for the same token (session-stability invariant)', () => {
    const token = makeJwt({ sub: 's', tid: 't', email: 'e' })
    expect(deriveEncryptionKey(token)).toBe(deriveEncryptionKey(token))
  })

  it('interpolates undefined for a missing claim', () => {
    const token = makeJwt({ sub: 's', tid: 't' })
    expect(deriveEncryptionKey(token)).toBe('s:t:undefined')
  })

  it('decodes real base64url payloads containing - and _', () => {
    const claims = { sub: '???', tid: '>>>', email: 'a/b+c@example.com' }
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
    // guard: the fixture must really contain base64url-specific chars
    expect(payload).toMatch(/[-_]/)
    const token = `header.${payload}.sig`
    expect(deriveEncryptionKey(token)).toBe('???:>>>:a/b+c@example.com')
  })

  it.each([
    ['a non-JWT string', 'garbage'],
    ['a token with no payload segment', 'header'],
    ['a payload that is not valid base64 JSON', 'header.!!!notbase64!!!.sig'],
  ])('throws and logs on %s', (_label, token) => {
    expect(() => deriveEncryptionKey(token)).toThrow(
      'Failed to derive encryption key from token',
    )
    expect(errorMock).toHaveBeenCalledWith(
      'Error deriving encryption key',
      expect.anything(),
    )
  })
})
