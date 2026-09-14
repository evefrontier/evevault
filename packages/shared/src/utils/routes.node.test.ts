import { describe, expect, it } from 'vitest'
import {
  isSessionExpiredSearch,
  SESSION_EXPIRED_PARAM,
  sessionExpiredLoginPath,
} from '#/utils/routes'

describe('session-expired login signal', () => {
  it('builds a login path carrying the expired-session flag', () => {
    expect(sessionExpiredLoginPath()).toBe(`/?${SESSION_EXPIRED_PARAM}=1`)
  })

  it.each([true, '1'])('reads %o as the expired-session flag', (value) => {
    expect(isSessionExpiredSearch(value)).toBe(true)
  })

  it.each([
    undefined,
    null,
    false,
    '',
    '0',
    'true',
    0,
    1,
  ])('treats %o as not expired', (value) => {
    expect(isSessionExpiredSearch(value)).toBe(false)
  })
})
