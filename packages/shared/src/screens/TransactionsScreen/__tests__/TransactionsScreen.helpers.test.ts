import { describe, expect, it, vi } from 'vitest'
import type { Transaction, TransactionBalanceChange } from '#/types/components'
import { SUI_COIN_TYPE } from '#/utils/constants'
import {
  getBalanceChangeAmount,
  getBalanceChangeTitle,
  getNextExpandedDigest,
  getSummaryClasses,
  getTransactionRowSummary,
  getTransactionStatusMessage,
  getTransactionsFromPages,
  openExternalUrl,
} from '../TransactionsScreen.helpers'

/**
 * Builds a realistic transaction fixture so tests can override only the field
 * relevant to a formatter or status case.
 */
function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    balanceChanges: [
      {
        amount: '12.3456',
        coinType: '0x1::token::TOKEN',
        isDebit: false,
        tokenName: 'Token',
        tokenSymbol: 'TKN',
      },
    ],
    counterparty: '0x1234567890abcdef1234567890abcdef',
    digest: '0xabcdef1234567890abcdef1234567890abcdef12',
    direction: 'received',
    timestamp: 1704067200000,
    ...overrides,
  }
}

describe('getTransactionStatusMessage', () => {
  it('returns an error message first when transaction loading fails', () => {
    expect(
      getTransactionStatusMessage({
        error: new Error('GraphQL unavailable'),
        hasTransactions: false,
        isError: true,
        isLoading: true,
      }),
    ).toEqual({
      color: 'error',
      text: 'GraphQL unavailable',
    })
  })

  it('returns loading and empty states before clearing the status', () => {
    expect(
      getTransactionStatusMessage({
        error: null,
        hasTransactions: false,
        isError: false,
        isLoading: true,
      }),
    ).toEqual({
      color: 'grey-neutral',
      text: 'Loading transactions...',
    })

    expect(
      getTransactionStatusMessage({
        error: null,
        hasTransactions: false,
        isError: false,
        isLoading: false,
      }),
    ).toEqual({
      color: 'grey-neutral',
      text: 'No transactions found',
    })

    expect(
      getTransactionStatusMessage({
        error: null,
        hasTransactions: true,
        isError: false,
        isLoading: false,
      }),
    ).toBeNull()
  })
})

describe('transaction list helpers', () => {
  it('flattens paginated transactions and falls back to an empty list', () => {
    const first = createTransaction({ digest: 'first' })
    const second = createTransaction({ digest: 'second' })

    expect(
      getTransactionsFromPages([
        { transactions: [first] },
        { transactions: [second] },
      ]),
    ).toEqual([first, second])
    expect(getTransactionsFromPages()).toEqual([])
  })

  it('toggles expanded transaction digests', () => {
    expect(getNextExpandedDigest(null, 'digest-1')).toBe('digest-1')
    expect(getNextExpandedDigest('digest-1', 'digest-1')).toBeNull()
    expect(getNextExpandedDigest('digest-1', 'digest-2')).toBe('digest-2')
  })

  it('returns summary classes for expanded and collapsed rows', () => {
    expect(getSummaryClasses(true)).toContain('bg-quantum-40')
    expect(getSummaryClasses(false)).toContain('hover:bg-quantum-10')
  })

  it('formats received and sent row summaries', () => {
    expect(getTransactionRowSummary(createTransaction())).toEqual({
      iconName: 'ArrowLeft',
      shortCounterparty: '0x1234•••abcdef',
      shortDigest: '0xabcdef•••abcdef12',
      summaryAmounts: '12.3456 TKN',
    })

    expect(
      getTransactionRowSummary(
        createTransaction({
          direction: 'sent',
          balanceChanges: [
            {
              amount: '1',
              coinType: SUI_COIN_TYPE,
              isDebit: true,
              tokenName: 'Sui',
              tokenSymbol: 'SUI',
            },
          ],
        }),
      ).summaryAmounts,
    ).toBe('−1 SUI')
  })

  it('leaves a non-address counterparty label untruncated', () => {
    expect(
      getTransactionRowSummary(
        createTransaction({ counterparty: 'address_alias::add' }),
      ).shortCounterparty,
    ).toBe('address_alias::add')
  })

  it('leaves sent summaries unsigned when there are no balance changes', () => {
    expect(
      getTransactionRowSummary(
        createTransaction({
          balanceChanges: [],
          direction: 'sent',
        }),
      ).summaryAmounts,
    ).toBe('')
  })
})

describe('balance change helpers', () => {
  it('formats token and gas balance change details', () => {
    const gasChange: TransactionBalanceChange = {
      amount: '0.001',
      coinType: SUI_COIN_TYPE,
      isDebit: true,
      tokenName: 'Sui',
      tokenSymbol: 'SUI',
    }
    const tokenChange: TransactionBalanceChange = {
      amount: '5',
      coinType: '0x1::token::TOKEN',
      tokenName: 'Token',
      tokenSymbol: 'TKN',
    }

    expect(getBalanceChangeTitle(gasChange)).toBe('Gas: Sui')
    expect(getBalanceChangeAmount(gasChange)).toBe('−0.001 SUI')
    expect(getBalanceChangeTitle(tokenChange)).toBe('Token: Token')
    expect(getBalanceChangeAmount(tokenChange)).toBe('5 TKN')
    expect(
      getBalanceChangeTitle({ ...tokenChange, tokenName: undefined }),
    ).toBeNull()
  })
})

describe('openExternalUrl', () => {
  it('opens links in a new isolated tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    openExternalUrl('https://example.test/tx')

    expect(open).toHaveBeenCalledWith(
      'https://example.test/tx',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })
})
