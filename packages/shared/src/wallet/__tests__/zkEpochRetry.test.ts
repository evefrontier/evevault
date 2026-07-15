import { SUI_DEVNET_CHAIN, SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockRotateEphemeralKey } = vi.hoisted(() => ({
  mockRotateEphemeralKey: vi.fn(),
}))

vi.mock('#/stores/deviceStore', () => ({
  useDeviceStore: {
    getState: () => ({ rotateEphemeralKey: mockRotateEphemeralKey }),
  },
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

import {
  isZkLoginEpochExpiredError,
  withZkLoginEpochRetry,
} from '#/wallet/zkEpochRetry'

const EXPIRED_MESSAGE =
  'Invalid user signature: Signature is not valid: ZKLogin expired at epoch 17, current epoch 18'
const EXPIRED_MESSAGE_ENCODED =
  'Invalid%20user%20signature:%20Signature%20is%20not%20valid:%20ZKLogin%20expired%20at%20epoch%2017,%20current%20epoch%2018'

describe('isZkLoginEpochExpiredError', () => {
  it('matches the plain fullnode rejection message', () => {
    expect(isZkLoginEpochExpiredError(new Error(EXPIRED_MESSAGE))).toBe(true)
  })

  it('matches the URL-encoded rejection message', () => {
    expect(isZkLoginEpochExpiredError(new Error(EXPIRED_MESSAGE_ENCODED))).toBe(
      true,
    )
  })

  it('rejects unrelated errors and non-Error values', () => {
    expect(isZkLoginEpochExpiredError(new Error('Insufficient gas'))).toBe(
      false,
    )
    expect(isZkLoginEpochExpiredError(EXPIRED_MESSAGE)).toBe(false)
    expect(isZkLoginEpochExpiredError(null)).toBe(false)
  })
})

describe('withZkLoginEpochRetry', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the result without rotating when the first attempt succeeds', async () => {
    const signAndSubmit = vi.fn().mockResolvedValue('digest')

    await expect(
      withZkLoginEpochRetry(SUI_DEVNET_CHAIN, signAndSubmit),
    ).resolves.toBe('digest')

    expect(signAndSubmit).toHaveBeenCalledTimes(1)
    expect(mockRotateEphemeralKey).not.toHaveBeenCalled()
  })

  it('rotates the ephemeral key and retries once on an epoch-expired rejection', async () => {
    const signAndSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error(EXPIRED_MESSAGE_ENCODED))
      .mockResolvedValueOnce('digest')

    await expect(
      withZkLoginEpochRetry(SUI_DEVNET_CHAIN, signAndSubmit),
    ).resolves.toBe('digest')

    expect(mockRotateEphemeralKey).toHaveBeenCalledWith(SUI_DEVNET_CHAIN)
    expect(signAndSubmit).toHaveBeenCalledTimes(2)
  })

  it('rethrows unrelated errors without rotating', async () => {
    const signAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error('Insufficient gas'))

    await expect(
      withZkLoginEpochRetry(SUI_DEVNET_CHAIN, signAndSubmit),
    ).rejects.toThrow('Insufficient gas')

    expect(signAndSubmit).toHaveBeenCalledTimes(1)
    expect(mockRotateEphemeralKey).not.toHaveBeenCalled()
  })

  it('does not rotate on localnet, where there is no zkLogin flow', async () => {
    const signAndSubmit = vi.fn().mockRejectedValue(new Error(EXPIRED_MESSAGE))

    await expect(
      withZkLoginEpochRetry(SUI_LOCALNET_CHAIN, signAndSubmit),
    ).rejects.toThrow(/ZKLogin expired/)

    expect(mockRotateEphemeralKey).not.toHaveBeenCalled()
  })

  it('propagates the error when the retry also fails, without retrying again', async () => {
    const signAndSubmit = vi.fn().mockRejectedValue(new Error(EXPIRED_MESSAGE))

    await expect(
      withZkLoginEpochRetry(SUI_DEVNET_CHAIN, signAndSubmit),
    ).rejects.toThrow(/ZKLogin expired/)

    expect(mockRotateEphemeralKey).toHaveBeenCalledTimes(1)
    expect(signAndSubmit).toHaveBeenCalledTimes(2)
  })
})
