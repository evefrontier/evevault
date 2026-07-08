import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetExtendedEphemeralPublicKey } = vi.hoisted(() => ({
  mockGetExtendedEphemeralPublicKey: vi.fn(),
}))

vi.mock('@mysten/sui/zklogin', () => ({
  getExtendedEphemeralPublicKey: (...args: unknown[]) =>
    mockGetExtendedEphemeralPublicKey(...args),
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { makeJwt } from '#/testing'
import { fetchZkProof } from '#/wallet/zkProof'

const ID_TOKEN = makeJwt({ tenant: 'nova', sub: 'user-1' })
const ZKP_URL = 'https://api.test.pub.evefrontier.com/auth/zklogin/zkp'

const makeProofData = (overrides: Partial<Record<string, unknown>> = {}) => ({
  proofPoints: {
    a: ['1', '2'],
    b: [
      ['3', '4'],
      ['5', '6'],
    ],
    c: ['7', '8'],
  },
  issBase64Details: { value: 'aXNz', indexMod4: 1 },
  headerBase64: ID_TOKEN.split('.')[0],
  addressSeed: '12345678',
  ...overrides,
})

describe('fetchZkProof', () => {
  beforeEach(() => {
    mockGetExtendedEphemeralPublicKey.mockReturnValue('extended-public-key')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('posts a proof request to the tenant-derived URL with bearer + tenant headers', async () => {
    const proofData = makeProofData()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(proofData)),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
      }),
    ).resolves.toEqual(proofData)

    expect(mockGetExtendedEphemeralPublicKey).toHaveBeenCalledWith(
      'ephemeral-public-key',
    )
    expect(fetchMock).toHaveBeenCalledWith(ZKP_URL, {
      method: 'POST',
      headers: {
        'X-Tenant': 'nova',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ID_TOKEN}`,
      },
      body: JSON.stringify({
        extendedEphemeralPublicKey: 'extended-public-key',
        maxEpoch: 12,
        randomness: 'randomness',
      }),
    })
  })

  it('throws with the status and body on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('{"message":"bad request"}'),
      }),
    )

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
      }),
    ).rejects.toThrow(/failed \(400\).*bad request/)
  })

  it('throws when a 200 response is missing required proof fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi
          .fn()
          .mockResolvedValue(JSON.stringify({ addressSeed: '12345678' })),
      }),
    )

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
      }),
    ).rejects.toThrow(/missing required fields/)
  })

  it('throws when a 200 response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html>not json</html>'),
      }),
    )

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
      }),
    ).rejects.toThrow(/not valid JSON/)
  })

  it('re-throws when fetch itself rejects with a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    )

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
      }),
    ).rejects.toThrow('Network failure')
  })
})
