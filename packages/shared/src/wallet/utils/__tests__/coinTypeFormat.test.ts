import { describe, expect, it } from 'vitest'
import { isValidCoinTypeFormat } from '#/wallet/utils/coinTypeFormat'

describe('isValidCoinTypeFormat', () => {
  describe('simple coin type form (0x...::module::COIN)', () => {
    it('accepts the canonical SUI coin type', () => {
      expect(isValidCoinTypeFormat('0x2::sui::SUI')).toBe(true)
    })

    it('accepts a long hex package id', () => {
      expect(isValidCoinTypeFormat('0xabc123def456::my_module::MY_COIN')).toBe(
        true,
      )
    })
  })

  describe('generic Coin wrapper form (0x2::Coin<...>)', () => {
    it('accepts a wrapped coin type', () => {
      expect(isValidCoinTypeFormat('0x2::Coin<0xabc::module::COIN>')).toBe(true)
    })
  })

  describe('rejects malformed input', () => {
    it('rejects an empty string', () => {
      expect(isValidCoinTypeFormat('')).toBe(false)
    })

    it('rejects a missing 0x prefix', () => {
      expect(isValidCoinTypeFormat('2::sui::SUI')).toBe(false)
    })

    it('rejects a non-hex package id', () => {
      expect(isValidCoinTypeFormat('0xZZ::sui::SUI')).toBe(false)
    })

    it('rejects a missing third segment', () => {
      expect(isValidCoinTypeFormat('0x2::sui')).toBe(false)
    })

    it('rejects trailing characters after the generic close bracket', () => {
      expect(isValidCoinTypeFormat('0x2::Coin<0xabc::module::COIN>extra')).toBe(
        false,
      )
    })

    it('rejects surrounding whitespace', () => {
      expect(isValidCoinTypeFormat(' 0x2::sui::SUI ')).toBe(false)
    })
  })
})
