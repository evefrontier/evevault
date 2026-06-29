import { describe, expect, it } from 'vitest'
import { sha256 } from './sha256'

describe('sha256', () => {
  it('returns a real ArrayBuffer for string input', async () => {
    const result = await sha256('test')
    expect(result).toBeInstanceOf(ArrayBuffer)
  })

  it('produces consistent hashes for same input', async () => {
    const hash1 = await sha256('hello world')
    const hash2 = await sha256('hello world')

    const bytes1 = new Uint8Array(hash1)
    const bytes2 = new Uint8Array(hash2)

    expect(bytes1).toEqual(bytes2)
  })

  it('produces different hashes for different inputs', async () => {
    const hash1 = await sha256('input1')
    const hash2 = await sha256('input2')

    const bytes1 = new Uint8Array(hash1)
    const bytes2 = new Uint8Array(hash2)

    expect(bytes1).not.toEqual(bytes2)
  })

  it('produces 32-byte (256-bit) output', async () => {
    const result = await sha256('any input')
    expect(result.byteLength).toBe(32)
  })
})
