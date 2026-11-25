import { describe, expect, it } from 'vitest'
import {
  checkExplorerTemplate,
  getExplorerName,
  getExplorerUrl,
} from '#/utils/explorer'

describe('getExplorerUrl with Suiscan (default)', () => {
  it('generates correct URL for devnet', () => {
    const url = getExplorerUrl('sui:devnet', '0xabc123')
    expect(url).toBe('https://suiscan.xyz/devnet/tx/0xabc123')
  })

  it('generates correct URL for testnet', () => {
    const url = getExplorerUrl('sui:testnet', '0xdef456')
    expect(url).toBe('https://suiscan.xyz/testnet/tx/0xdef456')
  })

  it('generates correct URL for mainnet', () => {
    const url = getExplorerUrl('sui:mainnet', '0x789ghi')
    expect(url).toBe('https://suiscan.xyz/mainnet/tx/0x789ghi')
  })

  it('handles full transaction digest', () => {
    const digest = '8GmJh2Nf4p3YrTqK5XsL9WbVc1AdZe6HxQi7RuMo0JkC'
    const url = getExplorerUrl('sui:devnet', digest)
    expect(url).toBe(`https://suiscan.xyz/devnet/tx/${digest}`)
  })

  it('generates custom suiscan account URL for localnet', () => {
    const url = getExplorerUrl('sui:localnet', '0xdigest', undefined, {
      localnetUrl: 'http://127.0.0.1:9000',
    })
    expect(url).toBe(
      'https://custom.suiscan.xyz/custom/tx/0xdigest?network=http%3A%2F%2F127.0.0.1%3A9000',
    )
  })

  it('falls back to suiscan.xyz for localnet when opts are missing', () => {
    const url = getExplorerUrl('sui:localnet', '0xdigest')
    expect(url).toBe('https://suiscan.xyz/localnet/tx/0xdigest')
  })
})

describe('getExplorerUrl with SuiVision', () => {
  const suivision = { id: 'suivision' as const }

  it('links testnet and mainnet transactions to SuiVision', () => {
    expect(getExplorerUrl('sui:testnet', 'abc', suivision)).toBe(
      'https://testnet.suivision.xyz/txblock/abc',
    )
    expect(getExplorerUrl('sui:mainnet', 'abc', suivision)).toBe(
      'https://suivision.xyz/txblock/abc',
    )
    expect(getExplorerName('sui:testnet', suivision)).toBe('SuiVision')
  })

  it('falls back to Suiscan on networks SuiVision does not cover', () => {
    expect(getExplorerUrl('sui:devnet', 'abc', suivision)).toBe(
      'https://suiscan.xyz/devnet/tx/abc',
    )
    expect(getExplorerName('sui:devnet', suivision)).toBe('Suiscan')
  })

  it('keeps Suiscan custom view on localnet', () => {
    expect(
      getExplorerUrl('sui:localnet', 'abc', suivision, {
        localnetUrl: 'http://127.0.0.1:9000',
      }),
    ).toMatch(/^https:\/\/custom\.suiscan\.xyz\//)
    expect(getExplorerName('sui:localnet', suivision)).toBe('Suiscan')
  })
})

describe('getExplorerUrl with a custom template', () => {
  const custom = (customTemplate: string) => ({
    id: 'custom' as const,
    customTemplate,
  })

  it('substitutes the digest and network and names the link by host', () => {
    const explorer = custom(
      'https://explorer.example.com/{network}/tx/{digest}',
    )
    expect(getExplorerUrl('sui:testnet', 'abc', explorer)).toBe(
      'https://explorer.example.com/testnet/tx/abc',
    )
    expect(getExplorerName('sui:testnet', explorer)).toBe(
      'explorer.example.com',
    )
  })

  it('URL-encodes substituted values', () => {
    const explorer = custom('https://explorer.example.com/tx/{digest}')
    expect(getExplorerUrl('sui:testnet', 'a/b?c', explorer)).toBe(
      'https://explorer.example.com/tx/a%2Fb%3Fc',
    )
  })

  it('falls back to Suiscan while the template is invalid', () => {
    for (const template of [
      'http://explorer.example.com/tx/{digest}',
      'https://explorer.example.com/tx/',
      'https://',
    ]) {
      expect(getExplorerUrl('sui:testnet', 'abc', custom(template))).toBe(
        'https://suiscan.xyz/testnet/tx/abc',
      )
      expect(getExplorerName('sui:testnet', custom(template))).toBe('Suiscan')
    }
  })
})

describe('checkExplorerTemplate', () => {
  it('accepts an https template with {digest}', () => {
    expect(checkExplorerTemplate('https://x.example/tx/{digest}')).toEqual({
      ok: true,
      host: 'x.example',
    })
  })

  it('explains why a template is rejected', () => {
    expect(checkExplorerTemplate('http://x.example/{digest}')).toEqual({
      ok: false,
      error: 'Must start with https://',
    })
    expect(checkExplorerTemplate('https://x.example/tx')).toEqual({
      ok: false,
      error: 'Must include {digest}',
    })
  })
})
