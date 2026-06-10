import { describe, expect, it } from 'vitest'
import {
  buildValidationErrors,
  canSendToken,
  isFormValidForEstimate,
  isPositiveAmountWithinBalance,
} from '#/wallet/hooks/useSendToken.validation'

const DECIMALS = 9 // SUI uses 9 decimals
const ONE_SUI = 1_000_000_000n.toString()

describe('isPositiveAmountWithinBalance', () => {
  it('returns false for empty amount or "0"', () => {
    expect(isPositiveAmountWithinBalance('', ONE_SUI, DECIMALS)).toBe(false)
    expect(isPositiveAmountWithinBalance('0', ONE_SUI, DECIMALS)).toBe(false)
  })

  it('returns true when amount is in range', () => {
    expect(isPositiveAmountWithinBalance('0.5', ONE_SUI, DECIMALS)).toBe(true)
  })

  it('returns true when amount exactly equals the balance', () => {
    expect(isPositiveAmountWithinBalance('1', ONE_SUI, DECIMALS)).toBe(true)
  })

  it('returns false when amount is one smallest-unit over the balance', () => {
    const balance = 1_000_000_000n.toString()
    // 1.000000001 SUI = balance + 1 mist
    expect(
      isPositiveAmountWithinBalance('1.000000001', balance, DECIMALS),
    ).toBe(false)
  })

  it('returns false for a tiny positive amount above a smaller balance', () => {
    expect(isPositiveAmountWithinBalance('0.000000001', '0', DECIMALS)).toBe(
      false,
    )
  })

  it('returns false when amount cannot be parsed (catch path)', () => {
    expect(isPositiveAmountWithinBalance('abc', ONE_SUI, DECIMALS)).toBe(false)
  })

  it('returns false when amount has too many decimal places (catch path)', () => {
    // 10 fractional digits exceeds DECIMALS and toSmallestUnit throws
    expect(
      isPositiveAmountWithinBalance('1.0000000001', ONE_SUI, DECIMALS),
    ).toBe(false)
  })
})

describe('buildValidationErrors', () => {
  const allValid = {
    isNetworkReady: true,
    isAuthenticated: true,
    isWalletUnlocked: true,
    hasBalance: true,
    hasGas: true,
    recipientAddress: '',
    isValidRecipient: true,
    amount: '',
    isValidAmount: true,
  }

  it('returns an empty array when everything is valid', () => {
    expect(buildValidationErrors(allValid)).toEqual([])
  })

  it('returns every applicable error, not just the first', () => {
    const errors = buildValidationErrors({
      isNetworkReady: false,
      isAuthenticated: false,
      isWalletUnlocked: false,
      hasBalance: false,
      hasGas: false,
      recipientAddress: '0xabc',
      isValidRecipient: false,
      amount: '1',
      isValidAmount: false,
    })

    expect(errors).toEqual([
      'No network selected',
      'Not authenticated',
      'Wallet not ready',
      'Insufficient balance',
      'No SUI for gas (required for transaction fees)',
      'Invalid Sui address',
      'Invalid amount',
    ])
  })

  it('does not surface a recipient error while the field is empty', () => {
    const errors = buildValidationErrors({
      ...allValid,
      recipientAddress: '',
      isValidRecipient: false,
    })
    expect(errors).not.toContain('Invalid Sui address')
  })

  it('surfaces a recipient error once the field is non-empty', () => {
    const errors = buildValidationErrors({
      ...allValid,
      recipientAddress: '0xabc',
      isValidRecipient: false,
    })
    expect(errors).toContain('Invalid Sui address')
  })

  it('does not surface an amount error while the field is empty', () => {
    const errors = buildValidationErrors({
      ...allValid,
      amount: '',
      isValidAmount: false,
    })
    expect(errors).not.toContain('Invalid amount')
  })

  it('surfaces an amount error once the field is non-empty', () => {
    const errors = buildValidationErrors({
      ...allValid,
      amount: '5',
      isValidAmount: false,
    })
    expect(errors).toContain('Invalid amount')
  })
})

describe('canSendToken', () => {
  const allTrue = {
    isNetworkReady: true,
    isAuthenticated: true,
    isWalletUnlocked: true,
    hasBalance: true,
    hasGas: true,
    isValidRecipient: true,
    isValidAmount: true,
  }

  it('returns true when every condition is met', () => {
    expect(canSendToken(allTrue)).toBe(true)
  })

  it('returns false when any single condition is false', () => {
    for (const key of Object.keys(allTrue) as (keyof typeof allTrue)[]) {
      expect(canSendToken({ ...allTrue, [key]: false })).toBe(false)
    }
  })
})

describe('isFormValidForEstimate', () => {
  const valid = {
    isValidRecipient: true,
    isValidAmount: true,
    hasBalance: true,
    balanceLoading: false,
    effectiveSenderAddress: '0xsender',
    chain: 'sui:testnet',
  }

  it('returns true when the form is ready for a gas estimate', () => {
    expect(isFormValidForEstimate(valid)).toBe(true)
  })

  it('returns false while the balance is still loading', () => {
    expect(isFormValidForEstimate({ ...valid, balanceLoading: true })).toBe(
      false,
    )
  })

  it('returns false when there is no effective sender address', () => {
    expect(
      isFormValidForEstimate({ ...valid, effectiveSenderAddress: null }),
    ).toBe(false)
    expect(
      isFormValidForEstimate({ ...valid, effectiveSenderAddress: undefined }),
    ).toBe(false)
  })

  it('returns false when no chain is selected', () => {
    expect(isFormValidForEstimate({ ...valid, chain: undefined })).toBe(false)
  })
})
