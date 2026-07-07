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
      json: vi.fn().mockResolvedValue(proofData),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchZkProof({
        jwtRandomness: 'randomness',
        maxEpoch: '12',
        ephemeralPublicKey: 'ephemeral-public-key' as never,
        idToken: ID_TOKEN,
        network: 'testnet',
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
        network: 'testnet',
        ephemeralPublicKey: 'extended-public-key',
        maxEpoch: 12,
        randomness: 'randomness',
      }),
    })
  })

  it('defaults network to devnet when omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(makeProofData()),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchZkProof({
      jwtRandomness: 'randomness',
      maxEpoch: '9',
      ephemeralPublicKey: 'ephemeral-public-key' as never,
      idToken: ID_TOKEN,
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      network: 'devnet',
      maxEpoch: 9,
    })
  })

  it('passes the network param to the API and returns the corresponding response', async () => {
    const proofsByNetwork: Record<string, unknown> = {
      testnet: makeProofData({ addressSeed: '11111111' }),
      mainnet: makeProofData({ addressSeed: '22222222' }),
    }

    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        const { network } = JSON.parse(init.body as string)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(proofsByNetwork[network]),
        })
      })
    vi.stubGlobal('fetch', fetchMock)

    const baseParams = {
      jwtRandomness: 'randomness',
      maxEpoch: '12',
      ephemeralPublicKey: 'ephemeral-public-key' as never,
      idToken: ID_TOKEN,
    }

    const testnetResult = await fetchZkProof({
      ...baseParams,
      network: 'testnet',
    })
    const mainnetResult = await fetchZkProof({
      ...baseParams,
      network: 'mainnet',
    })

    expect(testnetResult).toEqual(proofsByNetwork.testnet)
    expect(mainnetResult).toEqual(proofsByNetwork.mainnet)
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
        json: vi.fn().mockResolvedValue({ addressSeed: '12345678' }),
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
