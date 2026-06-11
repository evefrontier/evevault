import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockParseStructTag } = vi.hoisted(() => ({
  mockParseStructTag: vi.fn(),
}))

vi.mock('@mysten/sui/utils', () => ({
  parseStructTag: (...args: unknown[]) => mockParseStructTag(...args),
}))

import { extractSymbolFromCoinType } from '#/wallet/utils/formatTransaction'

describe('extractSymbolFromCoinType', () => {
  beforeEach(() => {
    mockParseStructTag.mockReturnValue({ name: 'TOKEN' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('extracts symbol using parseStructTag', () => {
    expect(extractSymbolFromCoinType('0x1::module::TOKEN')).toBe('TOKEN')
    expect(mockParseStructTag).toHaveBeenCalledWith('0x1::module::TOKEN')
  })

  it('falls back to the original coin type when parseStructTag returns no name', () => {
    mockParseStructTag.mockReturnValue({ name: '' })

    expect(extractSymbolFromCoinType('0x1::module::TOKEN')).toBe(
      '0x1::module::TOKEN',
    )
  })

  it('falls back to simple parsing when parseStructTag throws', () => {
    mockParseStructTag.mockImplementation(() => {
      throw new Error('invalid struct tag')
    })

    expect(extractSymbolFromCoinType('0x1::module::TOKEN')).toBe('TOKEN')
  })

  it('returns the original input when fallback parsing has no usable suffix', () => {
    mockParseStructTag.mockImplementation(() => {
      throw new Error('invalid struct tag')
    })

    expect(extractSymbolFromCoinType('not-a-struct-tag')).toBe(
      'not-a-struct-tag',
    )
  })
})
