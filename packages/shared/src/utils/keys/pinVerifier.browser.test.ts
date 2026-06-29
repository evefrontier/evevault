import { describe, expect, it } from 'vitest'
import { createPinVerifier, verifyPin } from './pinVerifier'

describe('createPinVerifier / verifyPin', () => {
  it('produces an Argon2id encoded verifier string', async () => {
    const verifier = await createPinVerifier('123456')
    expect(verifier.startsWith('$argon2id$')).toBe(true)
  })

  it('verifies the correct PIN', async () => {
    const verifier = await createPinVerifier('123456')
    expect(await verifyPin('123456', verifier)).toBe(true)
  })

  it('rejects an incorrect PIN', async () => {
    const verifier = await createPinVerifier('123456')
    expect(await verifyPin('654321', verifier)).toBe(false)
  })

  it('uses a random salt so the same PIN yields different verifiers', async () => {
    const a = await createPinVerifier('123456')
    const b = await createPinVerifier('123456')
    expect(a).not.toBe(b)
    // ...yet both still verify the same PIN
    expect(await verifyPin('123456', a)).toBe(true)
    expect(await verifyPin('123456', b)).toBe(true)
  })

  it('returns false (does not throw) on a malformed verifier', async () => {
    expect(await verifyPin('123456', 'not-a-valid-hash')).toBe(false)
  })
})
