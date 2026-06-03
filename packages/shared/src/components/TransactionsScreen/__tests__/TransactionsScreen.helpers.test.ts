import { describe, expect, it } from 'vitest'
import { getTransactionStatusMessage } from '../TransactionsScreen.helpers'

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
