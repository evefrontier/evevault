import type { SuiChain } from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JwtResponse } from '#/types/authTypes'

const getZkLoginJwtForNetworkMock = vi.hoisted(() => vi.fn())
const storeZkLoginJwtForNetworkMock = vi.hoisted(() => vi.fn())
const vendJwtMock = vi.hoisted(() => vi.fn())
const decodeJwtMock = vi.hoisted(() => vi.fn())
const infoMock = vi.hoisted(() => vi.fn())
const getCurrentTenantIdMock = vi.hoisted(() => vi.fn(() => 'stillness'))
const verifyIdTokenForTenantMock = vi.hoisted(() => vi.fn())

vi.mock('#/auth/storageService', () => ({
  getZkLoginJwtForNetwork: getZkLoginJwtForNetworkMock,
  storeZkLoginJwtForNetwork: storeZkLoginJwtForNetworkMock,
}))
vi.mock('#/auth/vendToken', () => ({ vendJwt: vendJwtMock }))
vi.mock('#/auth/verifyJwt', () => ({
  verifyIdTokenForTenant: verifyIdTokenForTenantMock,
}))
vi.mock('#/stores/tenantStore', () => ({
  getCurrentTenantId: getCurrentTenantIdMock,
}))
vi.mock('jose', () => ({ decodeJwt: decodeJwtMock }))
vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    info: infoMock,
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { resolveVendedIdTokenForZkProof } from '#/auth/zkJwt'

const NOW_MS = 1_700_000_000_000
const NOW_SEC = Math.floor(NOW_MS / 1000)
const CHAIN = 'sui:testnet' as SuiChain
const DEVICE_NONCE = 'device-nonce'
const PRIMARY_JWT = { id_token: 'primary.id.jwt' } as JwtResponse
const NEW_TOKEN = 'new.id.jwt'

/** A stored reuse candidate that is valid on every axis unless overridden. */
const validStored = {
  id_token: 'stored.id.jwt',
  expires_at: NOW_SEC + 3600,
}
const VALID_EPOCH_MS = NOW_MS + 60_000

describe('resolveVendedIdTokenForZkProof', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
    vendJwtMock.mockResolvedValue(NEW_TOKEN)
    decodeJwtMock.mockReturnValue({ nonce: DEVICE_NONCE, exp: NOW_SEC + 7200 })
    verifyIdTokenForTenantMock.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('reuse path', () => {
    it('returns the stored token when jwt is valid, nonce matches, and epoch is valid', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(validStored)
      decodeJwtMock.mockReturnValue({ nonce: DEVICE_NONCE })

      const result = await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        VALID_EPOCH_MS,
      )

      expect(result).toBe(validStored.id_token)
      expect(vendJwtMock).not.toHaveBeenCalled()
      expect(storeZkLoginJwtForNetworkMock).not.toHaveBeenCalled()
    })
  })

  describe('re-vend reasons', () => {
    const expectReVendedWithReasons = (reasons: string[]) => {
      expect(vendJwtMock).toHaveBeenCalledWith(PRIMARY_JWT.id_token, {
        nonce: DEVICE_NONCE,
      })
      expect(infoMock).toHaveBeenCalledWith(
        'Re-vending zkLogin JWT due to stale reuse candidate',
        expect.objectContaining({ reasons }),
      )
    }

    it('re-vends when the stored jwt is expired', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue({
        ...validStored,
        expires_at: NOW_SEC - 10,
      })
      decodeJwtMock.mockReturnValueOnce({ nonce: DEVICE_NONCE }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      const result = await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        VALID_EPOCH_MS,
      )

      expect(result).toBe(NEW_TOKEN)
      expectReVendedWithReasons(['jwt_expired'])
    })

    it('re-vends when the nonce does not match', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(validStored)
      decodeJwtMock.mockReturnValueOnce({ nonce: 'other-nonce' }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        VALID_EPOCH_MS,
      )

      expectReVendedWithReasons(['nonce_mismatch'])
    })

    it('re-vends when the epoch timestamp is null', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(validStored)
      decodeJwtMock.mockReturnValueOnce({ nonce: DEVICE_NONCE }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        null,
      )

      expectReVendedWithReasons(['epoch_expired_or_missing'])
    })

    it('re-vends when the epoch is already past', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(validStored)
      decodeJwtMock.mockReturnValueOnce({ nonce: DEVICE_NONCE }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        NOW_MS - 1000,
      )

      expectReVendedWithReasons(['epoch_expired_or_missing'])
    })

    it('combines multiple reasons', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue({
        ...validStored,
        expires_at: NOW_SEC - 10,
      })
      decodeJwtMock.mockReturnValueOnce({ nonce: 'other-nonce' }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        null,
      )

      expectReVendedWithReasons([
        'jwt_expired',
        'nonce_mismatch',
        'epoch_expired_or_missing',
      ])
    })

    it('re-vends and logs a decode failure when decodeJwt throws on the stored token', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(validStored)
      decodeJwtMock.mockImplementationOnce(() => {
        throw new Error('bad token')
      }) // stored
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      const result = await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        VALID_EPOCH_MS,
      )

      expect(result).toBe(NEW_TOKEN)
      expect(infoMock).toHaveBeenCalledWith(
        'Re-vending zkLogin JWT due to decode failure',
        { chain: CHAIN },
      )
    })

    it('vends directly when there is no stored token', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(null)
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 7200 }) // new

      const result = await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        VALID_EPOCH_MS,
      )

      expect(result).toBe(NEW_TOKEN)
      expect(vendJwtMock).toHaveBeenCalledOnce()
    })

    it('propagates when the vended token fails signature verification', async () => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(null)
      verifyIdTokenForTenantMock.mockRejectedValue(
        new Error('signature verification failed'),
      )

      await expect(
        resolveVendedIdTokenForZkProof(
          CHAIN,
          PRIMARY_JWT,
          DEVICE_NONCE,
          VALID_EPOCH_MS,
        ),
      ).rejects.toThrow('signature verification failed')

      expect(storeZkLoginJwtForNetworkMock).not.toHaveBeenCalled()
    })
  })

  describe('expires_at computation (no stored token)', () => {
    beforeEach(() => {
      getZkLoginJwtForNetworkMock.mockResolvedValue(null)
    })

    it('uses the min of epoch expiry and jwt expiry when both are present', async () => {
      const epochMs = (NOW_SEC + 100) * 1000
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 50 })

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        epochMs,
      )

      expect(storeZkLoginJwtForNetworkMock).toHaveBeenCalledWith(
        { id_token: NEW_TOKEN, expires_at: NOW_SEC + 50 },
        CHAIN,
      )
    })

    it('falls back to epoch expiry when the jwt has no exp', async () => {
      const epochMs = (NOW_SEC + 100) * 1000
      decodeJwtMock.mockReturnValueOnce({})

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        epochMs,
      )

      expect(storeZkLoginJwtForNetworkMock).toHaveBeenCalledWith(
        { id_token: NEW_TOKEN, expires_at: NOW_SEC + 100 },
        CHAIN,
      )
    })

    it('falls back to jwt expiry when the epoch is null', async () => {
      decodeJwtMock.mockReturnValueOnce({ exp: NOW_SEC + 50 })

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        null,
      )

      expect(storeZkLoginJwtForNetworkMock).toHaveBeenCalledWith(
        { id_token: NEW_TOKEN, expires_at: NOW_SEC + 50 },
        CHAIN,
      )
    })

    it('falls back to now + 3600 when both are null', async () => {
      decodeJwtMock.mockReturnValueOnce({})

      await resolveVendedIdTokenForZkProof(
        CHAIN,
        PRIMARY_JWT,
        DEVICE_NONCE,
        null,
      )

      expect(storeZkLoginJwtForNetworkMock).toHaveBeenCalledWith(
        { id_token: NEW_TOKEN, expires_at: NOW_SEC + 3600 },
        CHAIN,
      )
    })
  })
})
