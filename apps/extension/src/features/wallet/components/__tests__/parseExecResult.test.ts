import type { SuiClientTypes } from '@mysten/sui/client'
import { describe, expect, it } from 'vitest'
import { parseExecResult } from '../parseExecResult'

type ExecResult = SuiClientTypes.TransactionResult<{ effects: true }>

function makeSuccess(digest: string, bcs: Uint8Array): ExecResult {
  return {
    $kind: 'Transaction',
    Transaction: {
      digest,
      effects: { bcs },
    },
  } as ExecResult
}

function makeFailure(status: unknown): ExecResult {
  return {
    $kind: 'FailedTransaction',
    FailedTransaction: { status },
  } as ExecResult
}

describe('parseExecResult', () => {
  describe('FailedTransaction branch', () => {
    it('throws the error message from status.error.message', () => {
      const result = makeFailure({ error: { message: 'move abort 1' } })
      expect(() => parseExecResult(result)).toThrow('move abort 1')
    })

    it('throws "Transaction failed" when status.error has no message', () => {
      const result = makeFailure({ error: {} })
      expect(() => parseExecResult(result)).toThrow('Transaction failed')
    })

    it('throws "Transaction failed" when status has no error key', () => {
      const result = makeFailure({ someOtherField: true })
      expect(() => parseExecResult(result)).toThrow('Transaction failed')
    })

    it('throws "Transaction failed" when status is not an object', () => {
      const result = makeFailure('string status')
      expect(() => parseExecResult(result)).toThrow('Transaction failed')
    })

    it('throws "Transaction failed" when status is null', () => {
      const result = makeFailure(null)
      expect(() => parseExecResult(result)).toThrow('Transaction failed')
    })
  })

  describe('missing digest or effects', () => {
    it('throws when digest is missing', () => {
      const result = {
        $kind: 'Transaction',
        Transaction: { digest: '', effects: { bcs: new Uint8Array([1]) } },
      } as ExecResult
      expect(() => parseExecResult(result)).toThrow(
        'Transaction execution result is missing digest or effects',
      )
    })

    it('throws when effects.bcs is null', () => {
      const result = {
        $kind: 'Transaction',
        Transaction: { digest: 'abc', effects: { bcs: null } },
      } as ExecResult
      expect(() => parseExecResult(result)).toThrow(
        'Transaction execution result is missing digest or effects',
      )
    })

    it('throws when effects is missing entirely', () => {
      const result = {
        $kind: 'Transaction',
        Transaction: { digest: 'abc' },
      } as ExecResult
      expect(() => parseExecResult(result)).toThrow(
        'Transaction execution result is missing digest or effects',
      )
    })
  })

  describe('success path', () => {
    it('returns digest and base64-encoded effects', () => {
      const bcs = new Uint8Array([1, 2, 3])
      const result = makeSuccess('deadbeef', bcs)
      expect(parseExecResult(result)).toEqual({
        digest: 'deadbeef',
        effects: 'AQID',
      })
    })

    it('passes through the digest unchanged', () => {
      const bcs = new Uint8Array([0])
      const result = makeSuccess('some-digest-string', bcs)
      expect(parseExecResult(result).digest).toBe('some-digest-string')
    })
  })
})
