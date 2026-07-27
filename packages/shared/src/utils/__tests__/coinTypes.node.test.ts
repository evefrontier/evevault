import { describe, expect, it } from 'vitest'
import { isSameCoinType, isSuiCoinType } from '#/utils/coinTypes'
import { SUI_COIN_TYPE } from '#/utils/constants'

const LONG_FORM_SUI =
  '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'

describe('isSuiCoinType', () => {
  it('matches the short form', () => {
    expect(isSuiCoinType(SUI_COIN_TYPE)).toBe(true)
  })

  it('matches the long form returned by GraphQL/dapps', () => {
    expect(isSuiCoinType(LONG_FORM_SUI)).toBe(true)
  })

  it('rejects other coin types', () => {
    expect(isSuiCoinType('0x2::coin::COIN')).toBe(false)
    expect(
      isSuiCoinType('0xabc::eve_token_stillness::EVE_TOKEN_STILLNESS'),
    ).toBe(false)
  })

  it('rejects unparseable strings without throwing', () => {
    expect(isSuiCoinType('not-a-struct-tag')).toBe(false)
    expect(isSuiCoinType('')).toBe(false)
  })
})

describe('isSameCoinType', () => {
  it('treats short and long forms as equal', () => {
    expect(isSameCoinType(SUI_COIN_TYPE, LONG_FORM_SUI)).toBe(true)
    expect(isSameCoinType(LONG_FORM_SUI, SUI_COIN_TYPE)).toBe(true)
  })

  it('compares equal strings without normalization', () => {
    expect(isSameCoinType('anything', 'anything')).toBe(true)
  })

  it('distinguishes different coins', () => {
    expect(isSameCoinType(SUI_COIN_TYPE, '0x2::coin::COIN')).toBe(false)
  })

  it('returns false when either side is unparseable', () => {
    expect(isSameCoinType('garbage', SUI_COIN_TYPE)).toBe(false)
  })
})
