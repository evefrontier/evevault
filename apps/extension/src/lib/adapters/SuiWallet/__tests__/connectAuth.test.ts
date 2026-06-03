import { getZkLoginAddress } from '@evevault/shared/auth'
import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAccountsFromAuthSuccess } from '../connectAuth'

vi.mock('@evevault/shared/auth', () => ({
  getZkLoginAddress: vi.fn(),
}))

const mockGetZkLoginAddress = vi.mocked(getZkLoginAddress)

describe('getAccountsFromAuthSuccess', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('builds a localnet account without looking up zkLogin details', async () => {
    const [account] = await getAccountsFromAuthSuccess(
      {
        chain: SUI_LOCALNET_CHAIN,
        address: '0xlocal',
      },
      [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN],
    )

    expect(account.address).toBe('0xlocal')
    expect(account.chains).toEqual([SUI_LOCALNET_CHAIN])
    expect(account.publicKey).toEqual(new Uint8Array(0))
    expect(mockGetZkLoginAddress).not.toHaveBeenCalled()
  })

  it('throws when localnet auth succeeds without an address', async () => {
    await expect(
      getAccountsFromAuthSuccess({ chain: SUI_LOCALNET_CHAIN }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('Localnet auth_success missing address')
  })

  it('builds a zkLogin account and stores the JWT for non-localnet auth', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: {
        address: '0xzk',
        publicKey: 'AQID',
      },
      error: undefined,
    })

    const [account] = await getAccountsFromAuthSuccess(
      { token: { access_token: 'jwt-token' } },
      [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN],
    )

    expect(account.address).toBe('0xzk')
    expect(account.chains).toEqual([SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN])
    expect(account.publicKey).toEqual(new Uint8Array([1, 2, 3]))
    expect(sessionStorage.getItem('evevault_jwt')).toBe('"jwt-token"')
  })

  it('throws when the auth response does not include an access token', async () => {
    await expect(
      getAccountsFromAuthSuccess({}, [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN]),
    ).rejects.toThrow('Authentication response missing access token')
  })

  it('throws when zkLogin returns an error', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: undefined,
      error: { message: 'lookup failed' },
    })

    await expect(
      getAccountsFromAuthSuccess({ token: { access_token: 'jwt-token' } }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('lookup failed')
  })

  it('throws when zkLogin returns no data', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: undefined,
      error: undefined,
    })

    await expect(
      getAccountsFromAuthSuccess({ token: { access_token: 'jwt-token' } }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('No data returned from zkLogin address lookup')
  })

  it('throws when zkLogin returns a blank public key', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: {
        address: '0xzk',
        publicKey: '   ',
      },
      error: undefined,
    })

    await expect(
      getAccountsFromAuthSuccess({ token: { access_token: 'jwt-token' } }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('No public key returned from zkLogin address lookup')
  })

  it('throws when zkLogin returns an invalid base64 public key', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: {
        address: '0xzk',
        publicKey: '%%%not-base64%%%',
      },
      error: undefined,
    })

    await expect(
      getAccountsFromAuthSuccess({ token: { access_token: 'jwt-token' } }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow(
      'Invalid base64 public key returned from zkLogin address lookup',
    )
  })
})
