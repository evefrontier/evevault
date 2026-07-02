import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearZkLoginAddressCache,
  getZkLoginAddress,
} from '#/auth/getZkLoginAddress'

// A minimally-valid JWT (unsigned) whose payload carries the tenant/tier the
// URL is derived from. Default tenant + no tier => `test` tier host.
const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url')
const makeJwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'none' })}.${b64url(payload)}.`

const JWT = makeJwt({ tenant: 'nova', sub: 'user-1' })
const ZKLOGIN_URL = 'https://api.test.pub.evefrontier.com/auth/zklogin'

const okResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }) as unknown as Response

const errorResponse = (status: number, body: string) =>
  ({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as Response

describe('getZkLoginAddress', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearZkLoginAddressCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the tenant-derived URL with bearer + tenant headers and returns the data', async () => {
    const body = { address: '0xabc', salt: '1', publicKey: 'pk' }
    fetchMock.mockResolvedValue(okResponse(body))

    const result = await getZkLoginAddress({ jwt: JWT })

    expect(result).toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith(ZKLOGIN_URL, {
      method: 'GET',
      headers: {
        'X-Tenant': 'nova',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT}`,
      },
    })
  })

  it('caches successful responses so a repeat call does not re-fetch', async () => {
    const body = { address: '0xabc', salt: '1', publicKey: 'pk' }
    fetchMock.mockResolvedValue(okResponse(body))

    const first = await getZkLoginAddress({ jwt: JWT })
    const second = await getZkLoginAddress({ jwt: JWT })

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('throws with the status and body on a non-ok response, and does not cache it', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, '{"title":"Unauthorized"}'))

    await expect(getZkLoginAddress({ jwt: JWT })).rejects.toThrow(
      /failed \(401\).*Unauthorized/,
    )
    // Not cached — a retry re-fetches.
    fetchMock.mockResolvedValue(
      okResponse({ address: '0x1', salt: '1', publicKey: 'pk' }),
    )
    await getZkLoginAddress({ jwt: JWT })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when a 200 response is missing salt/address', async () => {
    fetchMock.mockResolvedValue(okResponse({ publicKey: 'pk' }))

    await expect(getZkLoginAddress({ jwt: JWT })).rejects.toThrow(
      /missing salt\/address/,
    )
  })

  it('keys the cache by JWT so a different token re-fetches', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ address: '0x1', salt: '1', publicKey: 'pk' }),
    )

    await getZkLoginAddress({ jwt: makeJwt({ tenant: 'nova', sub: 'a' }) })
    await getZkLoginAddress({ jwt: makeJwt({ tenant: 'nova', sub: 'b' }) })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('clearZkLoginAddressCache forces the next call to re-fetch', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ address: '0x1', salt: '1', publicKey: 'pk' }),
    )

    await getZkLoginAddress({ jwt: JWT })
    clearZkLoginAddressCache()
    await getZkLoginAddress({ jwt: JWT })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
