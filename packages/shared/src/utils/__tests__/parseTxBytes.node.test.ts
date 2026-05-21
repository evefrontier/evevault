import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseTransactionBytes } from '#/utils/parseTxBytes'

const mockToJSON = vi.fn()
const mockFrom = vi.fn()

vi.mock('@mysten/sui/transactions', () => ({
  Transaction: {
    from: (bytes: Uint8Array) => mockFrom(bytes),
  },
}))

vi.mock('@mysten/sui/utils', () => ({
  toBase64: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64'),
  fromBase64: (str: string) => {
    if (!/^[A-Za-z0-9+/]*=*$/.test(str)) {
      throw new Error('Invalid base64')
    }
    return new Uint8Array(Buffer.from(str, 'base64'))
  },
}))

describe('parseTransactionBytes', () => {
  beforeEach(() => {
    mockToJSON.mockReset()
    mockFrom.mockReset()

    // Default implementation
    mockToJSON.mockResolvedValue({ kind: 'ProgrammableTransaction', data: {} })
    mockFrom.mockImplementation((bytes: Uint8Array) => ({
      toJSON: () => mockToJSON(bytes),
    }))
  })

  describe('plain string (raw, unencoded)', () => {
    it('returns displayValue as the string and no transactionForSigning', async () => {
      const input = '{"kind":"ProgrammableTransaction"}'
      const result = await parseTransactionBytes(input)

      expect(result).toEqual({
        displayValue: input,
      })
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('returns displayValue unchanged when string is not comma-separated or base64', async () => {
      const input = '  \n  {"x":1}  \t  '
      const result = await parseTransactionBytes(input)

      expect(result.displayValue).toBe(input)
      expect(result.transactionForSigning).toBeUndefined()
    })
  })

  describe('object input', () => {
    it('normalizes to JSON string and returns it as displayValue and transactionForSigning', async () => {
      const input = { kind: 'ProgrammableTransaction', data: {} }
      const result = await parseTransactionBytes(input)

      expect(result).toEqual({
        displayValue: JSON.stringify(input, null, 2),
        transactionForSigning: JSON.stringify(input),
      })
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('comma-separated bytes', () => {
    it('returns displayValue from Transaction.toJSON() and transactionForSigning as base64', async () => {
      mockToJSON.mockResolvedValueOnce({
        kind: 'ProgrammableTransaction',
        data: { inputs: [] },
      })

      const input = '0,1,2,3,4'
      const result = await parseTransactionBytes(input)

      const expectedBytes = new Uint8Array([0, 1, 2, 3, 4])
      expect(mockFrom).toHaveBeenCalledWith(expectedBytes)

      expect(result.displayValue).toBe(
        JSON.stringify(
          { kind: 'ProgrammableTransaction', data: { inputs: [] } },
          null,
          2,
        ),
      )
      expect(result.transactionForSigning).toBe(
        Buffer.from(expectedBytes).toString('base64'),
      )
    })

    it('trims leading/trailing whitespace before checking comma-separated format', async () => {
      mockToJSON.mockResolvedValueOnce({ trimmed: true })

      const result = await parseTransactionBytes('  0,1,2  ')

      expect(mockFrom).toHaveBeenCalledWith(new Uint8Array([0, 1, 2]))
      expect(result.displayValue).toBe(
        JSON.stringify({ trimmed: true }, null, 2),
      )
      expect(result.transactionForSigning).toBe('AAEC')
    })

    it('on Transaction.from/toJSON failure returns original string as displayValue and no transactionForSigning', async () => {
      mockFrom.mockImplementationOnce(() => {
        throw new Error('Invalid transaction bytes')
      })

      const input = '0,1,2,999,4'
      const result = await parseTransactionBytes(input)

      expect(result).toEqual({ displayValue: input })
      expect(result.transactionForSigning).toBeUndefined()
    })

    it('allows whitespace around commas', async () => {
      const expectedBytes = new Uint8Array([0, 1, 2, 3])

      // Set up fresh mock for this test
      mockToJSON.mockResolvedValueOnce({ withSpaces: true })
      mockFrom.mockImplementationOnce((bytes: Uint8Array) => ({
        toJSON: () => mockToJSON(bytes),
      }))

      const result = await parseTransactionBytes('0, 1 , 2,  3')

      expect(mockFrom).toHaveBeenCalledWith(expectedBytes)
      expect(result.displayValue).toBe(
        JSON.stringify({ withSpaces: true }, null, 2),
      )
      expect(result.transactionForSigning).toBeDefined()
    })

    it('rejects byte values greater than 255', async () => {
      const input = '0,1,256,3'
      const result = await parseTransactionBytes(input)

      // Should fall back to returning original string as displayValue
      expect(result.displayValue).toBe(input)
      expect(result.transactionForSigning).toBeUndefined()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('rejects negative byte values', async () => {
      const input = '0,1,-1,3'
      const result = await parseTransactionBytes(input)

      expect(result.displayValue).toBe(input)
      expect(result.transactionForSigning).toBeUndefined()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('rejects non-integer byte values', async () => {
      const input = '0,1,2.5,3'
      const result = await parseTransactionBytes(input)

      expect(result.displayValue).toBe(input)
      expect(result.transactionForSigning).toBeUndefined()
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('base64 input', () => {
    it('decodes base64 and returns displayValue from Transaction.toJSON() and normalized base64 for signing', async () => {
      const bytes = new Uint8Array([0, 1, 2])
      const base64Input = Buffer.from(bytes).toString('base64')

      mockToJSON.mockResolvedValueOnce({
        kind: 'ProgrammableTransaction',
        fromBase64: true,
      })

      const result = await parseTransactionBytes(base64Input)

      expect(mockFrom).toHaveBeenCalledWith(bytes)
      expect(result.displayValue).toBe(
        JSON.stringify(
          { kind: 'ProgrammableTransaction', fromBase64: true },
          null,
          2,
        ),
      )
      expect(result.transactionForSigning).toBe(base64Input)
    })

    it('on invalid base64 (non-base64 chars) returns original string as displayValue', async () => {
      const input = 'not-valid-base64!!!'
      const result = await parseTransactionBytes(input)

      expect(result).toEqual({ displayValue: input })
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('on valid base64 but Transaction.from throws returns original string', async () => {
      const base64Input = Buffer.from(new Uint8Array([1, 2, 3])).toString(
        'base64',
      )
      mockFrom.mockImplementationOnce(() => {
        throw new Error('Unsupported version')
      })

      const result = await parseTransactionBytes(base64Input)

      expect(result).toEqual({ displayValue: base64Input })
    })

    it('normalizes base64 with leading/trailing whitespace', async () => {
      const bytes = new Uint8Array([0, 1, 2])
      const base64String = Buffer.from(bytes).toString('base64')
      const inputWithWhitespace = `  ${base64String}  `

      mockToJSON.mockResolvedValueOnce({ normalized: true })

      const result = await parseTransactionBytes(inputWithWhitespace)

      // Should trim the whitespace and use the trimmed version for signing
      expect(mockFrom).toHaveBeenCalledWith(bytes)
      expect(result.transactionForSigning).toBe(base64String)
      expect(result.displayValue).toBe(
        JSON.stringify({ normalized: true }, null, 2),
      )
    })
  })

  describe('result shape', () => {
    it('displayValue is always a string', async () => {
      const cases: (string | Record<string, unknown>)[] = [
        'plain',
        '{"json":true}',
        '0,1,2',
        { a: 1 },
      ]

      for (const input of cases) {
        const result = await parseTransactionBytes(input)
        expect(result).toHaveProperty('displayValue')
        expect(typeof result.displayValue).toBe('string')
      }
    })

    it('transactionForSigning is set for all valid transaction formats', async () => {
      // Comma-separated bytes returns base64
      const withComma = await parseTransactionBytes('0,1,2')
      expect(withComma).toHaveProperty('transactionForSigning')
      expect(typeof withComma.transactionForSigning).toBe('string')

      // Object returns JSON string
      const withObject = await parseTransactionBytes({ kind: 'test' })
      expect(withObject).toHaveProperty('transactionForSigning')
      expect(typeof withObject.transactionForSigning).toBe('string')

      // Base64 returns normalized (trimmed) base64
      const withBase64 = await parseTransactionBytes(
        Buffer.from([0, 1, 2]).toString('base64'),
      )
      expect(withBase64).toHaveProperty('transactionForSigning')
      expect(typeof withBase64.transactionForSigning).toBe('string')

      // Plain JSON string has no transactionForSigning
      const withJson = await parseTransactionBytes('{}')
      expect(withJson.transactionForSigning).toBeUndefined()
    })
  })
})
