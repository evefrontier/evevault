import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDeviceData } from '#/utils/getters'
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys'

const store = {
  getJwtRandomness: vi.fn(),
  getNonce: vi.fn(),
  getMaxEpoch: vi.fn(),
}

vi.mock('#/stores/deviceStore', () => ({
  useDeviceStore: { getState: () => store },
}))

const chain = SUI_TESTNET_CHAIN

const persistedNetworkData = {
  jwtRandomness: 'persisted-randomness',
  nonce: 'persisted-nonce',
  maxEpoch: 'persisted-epoch',
}

const persistedSnapshot = {
  state: { networkData: { [chain]: persistedNetworkData } },
}

function stubChromeStorage(value: unknown) {
  const get = vi.fn(async () => ({ [DEVICE_STORAGE_KEY]: value }))
  vi.stubGlobal('chrome', { storage: { local: { get } } })
  return get
}

describe('getDeviceData', () => {
  beforeEach(() => {
    store.getJwtRandomness.mockReturnValue(null)
    store.getNonce.mockReturnValue(null)
    store.getMaxEpoch.mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns store values without reading storage when the store is complete', async () => {
    store.getJwtRandomness.mockReturnValue('store-randomness')
    store.getNonce.mockReturnValue('store-nonce')
    store.getMaxEpoch.mockReturnValue('store-epoch')
    const get = stubChromeStorage(undefined)

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: 'store-randomness',
      nonce: 'store-nonce',
      maxEpoch: 'store-epoch',
    })
    expect(get).not.toHaveBeenCalled()
  })

  it('falls back to a string-serialized storage snapshot', async () => {
    stubChromeStorage(JSON.stringify(persistedSnapshot))

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: 'persisted-randomness',
      nonce: 'persisted-nonce',
      maxEpoch: 'persisted-epoch',
    })
  })

  it('falls back to an object-shaped storage snapshot', async () => {
    stubChromeStorage(persistedSnapshot)

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: 'persisted-randomness',
      nonce: 'persisted-nonce',
      maxEpoch: 'persisted-epoch',
    })
  })

  it('degrades to empty values on malformed JSON instead of throwing', async () => {
    stubChromeStorage('{not json')

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: null,
      nonce: undefined,
      maxEpoch: undefined,
    })
  })

  it('degrades to empty values on a fresh install with no stored snapshot', async () => {
    stubChromeStorage(undefined)

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: null,
      nonce: undefined,
      maxEpoch: undefined,
    })
  })

  it('degrades to empty values when the snapshot has no state key', async () => {
    stubChromeStorage({ unexpected: true })

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: null,
      nonce: undefined,
      maxEpoch: undefined,
    })
  })

  it('prefers store values over persisted ones per field', async () => {
    store.getNonce.mockReturnValue('store-nonce')
    stubChromeStorage(persistedSnapshot)

    await expect(getDeviceData(chain)).resolves.toEqual({
      jwtRandomness: 'persisted-randomness',
      nonce: 'store-nonce',
      maxEpoch: 'persisted-epoch',
    })
  })
})
