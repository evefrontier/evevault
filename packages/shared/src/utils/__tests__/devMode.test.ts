import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsWeb, mockWebGetItem, mockExtGetItem } = vi.hoisted(() => ({
  mockIsWeb: vi.fn(() => true),
  mockWebGetItem: vi.fn(),
  mockExtGetItem: vi.fn(),
}))

vi.mock('#/utils/environment', () => ({
  isWeb: () => mockIsWeb(),
}))

vi.mock('#/adapters/web', () => ({
  localStorageAdapter: { getItem: mockWebGetItem },
}))

vi.mock('#/adapters/extension', () => ({
  chromeStorageAdapter: { getItem: mockExtGetItem },
}))

import { getDevModeEnabled } from '#/utils/devMode'
import { CONTEXT_STORAGE_KEY } from '#/utils/storageKeys'

describe('getDevModeEnabled', () => {
  beforeEach(() => {
    mockIsWeb.mockReset().mockReturnValue(true)
    mockWebGetItem.mockReset()
    mockExtGetItem.mockReset()
  })

  it('returns false when nothing is stored', async () => {
    mockWebGetItem.mockResolvedValue(null)
    expect(await getDevModeEnabled()).toBe(false)
    expect(mockWebGetItem).toHaveBeenCalledWith(CONTEXT_STORAGE_KEY)
  })

  it('returns true when the persisted state has devMode === true', async () => {
    mockWebGetItem.mockResolvedValue(
      JSON.stringify({ state: { devMode: true }, version: 1 }),
    )
    expect(await getDevModeEnabled()).toBe(true)
  })

  it('returns false when devMode is false or absent', async () => {
    mockWebGetItem.mockResolvedValue(
      JSON.stringify({ state: { devMode: false } }),
    )
    expect(await getDevModeEnabled()).toBe(false)

    mockWebGetItem.mockResolvedValue(JSON.stringify({ state: {} }))
    expect(await getDevModeEnabled()).toBe(false)
  })

  it('returns false when the stored value is not valid JSON', async () => {
    mockWebGetItem.mockResolvedValue('{not-json')
    expect(await getDevModeEnabled()).toBe(false)
  })

  it('reads from the chrome storage adapter when not on web', async () => {
    mockIsWeb.mockReturnValue(false)
    mockExtGetItem.mockResolvedValue(
      JSON.stringify({ state: { devMode: true } }),
    )
    expect(await getDevModeEnabled()).toBe(true)
    expect(mockExtGetItem).toHaveBeenCalledWith(CONTEXT_STORAGE_KEY)
    expect(mockWebGetItem).not.toHaveBeenCalled()
  })
})
