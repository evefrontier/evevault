import { describe, expect, it } from 'vitest'
import type { HashedData } from '#/types/stores'
import { b64ToBytes, bytesToB64 } from '../base64'
import { decrypt } from './decrypt'
import { encrypt } from './encrypt'

const PIN = '123456'
const PLAINTEXT = 'super secret key material'

/** Flips the first byte of a base64 field so the decoded bytes differ but stay valid base64. */
const flipFirstByte = (b64: string): string => {
  const bytes = b64ToBytes(b64)
  bytes[0] ^= 0xff
  return bytesToB64(bytes)
}

describe('decrypt — tamper detection', () => {
  let encrypted: HashedData

  // Re-encrypt per test so a mutation never leaks into another case.
  const fresh = async () => encrypt(PLAINTEXT, PIN)

  it('rejects when the ciphertext (data) is tampered', async () => {
    encrypted = await fresh()
    const tampered = { ...encrypted, data: flipFirstByte(encrypted.data) }
    await expect(decrypt(tampered, PIN)).rejects.toThrow()
  })

  it('rejects when the iv is tampered', async () => {
    encrypted = await fresh()
    const tampered = { ...encrypted, iv: flipFirstByte(encrypted.iv) }
    await expect(decrypt(tampered, PIN)).rejects.toThrow()
  })

  it('rejects when the salt is tampered (wrong key derived)', async () => {
    encrypted = await fresh()
    const tampered = { ...encrypted, salt: flipFirstByte(encrypted.salt) }
    await expect(decrypt(tampered, PIN)).rejects.toThrow()
  })

  it('rejects when the ciphertext is truncated', async () => {
    encrypted = await fresh()
    const bytes = b64ToBytes(encrypted.data)
    const tampered = {
      ...encrypted,
      data: bytesToB64(bytes.slice(0, bytes.length - 4)),
    }
    await expect(decrypt(tampered, PIN)).rejects.toThrow()
  })

  it('rejects (does not silently return) on malformed base64 data', async () => {
    encrypted = await fresh()
    const tampered = { ...encrypted, data: '!!!not-base64!!!' }
    await expect(decrypt(tampered, PIN)).rejects.toThrow()
  })
})
