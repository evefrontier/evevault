import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { afterEach, describe, expect, it } from 'vitest'
import { getAccountsFromAuthSuccess } from '../connectAuth'

describe('getAccountsFromAuthSuccess', () => {
  afterEach(() => {
    sessionStorage.clear()
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
  })

  it('throws when localnet auth succeeds without an address', async () => {
    await expect(
      getAccountsFromAuthSuccess({ chain: SUI_LOCALNET_CHAIN }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('Localnet auth_success missing address')
  })

  it('builds a zkLogin account from background-resolved account metadata', async () => {
    const [account] = await getAccountsFromAuthSuccess(
      { address: '0xzk', publicKey: 'AQID' },
      [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN],
    )

    expect(account.address).toBe('0xzk')
    expect(account.chains).toEqual([SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN])
    expect(account.publicKey).toEqual(new Uint8Array([1, 2, 3]))
    expect(sessionStorage.length).toBe(0)
  })

  it('throws when the auth response does not include account metadata', async () => {
    await expect(
      getAccountsFromAuthSuccess({}, [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN]),
    ).rejects.toThrow('Authentication response missing account metadata')
  })

  it('throws when the auth response includes empty account metadata', async () => {
    await expect(
      getAccountsFromAuthSuccess({ address: '', publicKey: '' }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('Authentication response missing account metadata')
  })

  it('throws when zkLogin returns a blank public key', async () => {
    await expect(
      getAccountsFromAuthSuccess({ address: '0xzk', publicKey: '   ' }, [
        SUI_TESTNET_CHAIN,
        SUI_DEVNET_CHAIN,
      ]),
    ).rejects.toThrow('No public key returned from zkLogin address lookup')
  })

  it('throws when zkLogin returns an invalid base64 public key', async () => {
    await expect(
      getAccountsFromAuthSuccess(
        { address: '0xzk', publicKey: '%%%not-base64%%%' },
        [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN],
      ),
    ).rejects.toThrow(
      'Invalid base64 public key returned from zkLogin address lookup',
    )
  })
})
