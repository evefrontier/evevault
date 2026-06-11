import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearZkLoginAddressCache,
  getZkLoginAddress,
} from '#/auth/getZkLoginAddress'

const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1/zklogin'

const okResponse = (data: unknown) =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

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

  it('fetches with the API key and JWT headers and returns the response', async () => {
    const body = { data: { address: '0xabc', salt: '1', publicKey: 'pk' } }
    fetchMock.mockResolvedValue(okResponse(body))

    const result = await getZkLoginAddress({
      jwt: 'jwt-token',
      enokiApiKey: 'enoki-key',
    })

    expect(result).toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith(ENOKI_URL, {
      method: 'GET',
      headers: {
        Authorization: 'enoki-key',
        'zklogin-jwt': 'jwt-token',
      },
    })
  })

  it('caches successful responses so a repeat call does not re-fetch', async () => {
    const body = { data: { address: '0xabc', salt: '1', publicKey: 'pk' } }
    fetchMock.mockResolvedValue(okResponse(body))

    const params = { jwt: 'jwt-token', enokiApiKey: 'enoki-key' }
    const first = await getZkLoginAddress(params)
    const second = await getZkLoginAddress(params)

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not cache error responses, so a transient failure stays retryable on the next call', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ data: undefined, error: { message: 'bad jwt' } }),
    )

    const params = { jwt: 'jwt-token', enokiApiKey: 'enoki-key' }
    const first = await getZkLoginAddress(params)
    const second = await getZkLoginAddress(params)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The error payload is still returned to the caller on both calls.
    expect(first.error?.message).toBe('bad jwt')
    expect(second.error?.message).toBe('bad jwt')
  })

  it('keys the cache by API key + JWT so different params re-fetch', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ data: { address: '0x1', salt: '1', publicKey: 'pk' } }),
    )

    await getZkLoginAddress({ jwt: 'jwt-a', enokiApiKey: 'key' })
    await getZkLoginAddress({ jwt: 'jwt-b', enokiApiKey: 'key' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('clearZkLoginAddressCache forces the next call to re-fetch', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ data: { address: '0x1', salt: '1', publicKey: 'pk' } }),
    )

    const params = { jwt: 'jwt-token', enokiApiKey: 'enoki-key' }
    await getZkLoginAddress(params)
    clearZkLoginAddressCache()
    await getZkLoginAddress(params)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
