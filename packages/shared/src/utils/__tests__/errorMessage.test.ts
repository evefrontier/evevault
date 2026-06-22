import { describe, expect, it } from 'vitest'
import { toErrorMessage } from '#/utils/errorMessage'

describe('toErrorMessage', () => {
  it('uses Error messages and strings', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom')
    expect(toErrorMessage('plain failure')).toBe('plain failure')
  })

  it('unwraps structured message and error payloads', () => {
    expect(toErrorMessage({ message: 'structured failure' })).toBe(
      'structured failure',
    )
    expect(toErrorMessage({ error: { message: 'nested failure' } })).toBe(
      'nested failure',
    )
  })

  it('falls back for empty or object-string messages', () => {
    expect(toErrorMessage('', 'fallback')).toBe('fallback')
    expect(toErrorMessage('[object Object]', 'fallback')).toBe('fallback')
    expect(toErrorMessage(new Error('[object Object]'), 'fallback')).toBe(
      'fallback',
    )
    expect(toErrorMessage({}, 'fallback')).toBe('fallback')
  })
})
