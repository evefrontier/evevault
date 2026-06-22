import { EVEFRONTIER_SPONSORED_TRANSACTION } from '@evefrontier/wallet-core/wallet-features'
import { WalletStandardMessageTypes } from '@evevault/shared'
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
} from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EveVaultWallet } from '../index'
import { APPROVAL_TIMEOUT_MS } from '../vaultMessages'

const { logger } = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logger,
  }
})

describe('EveVaultWallet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'postMessage').mockImplementation(() => undefined)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'request-id' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  function lastPostedMessage() {
    const calls = vi.mocked(window.postMessage).mock.calls
    return calls[calls.length - 1][0] as Record<string, unknown>
  }

  // Same-origin and posted by the page window itself, matching the connect
  // listener's source+origin guard.
  function dispatchVaultMessage(data: Record<string, unknown>) {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: window,
        data: {
          __from: 'Eve Vault',
          id: 'request-id',
          ...data,
        },
      }),
    )
  }

  function makeTransaction(json = 'tx-json') {
    return {
      toJSON: vi.fn().mockResolvedValue(json),
    }
  }

  async function connectLocalnet(wallet: EveVaultWallet) {
    const promise = wallet.features[StandardConnect].connect()

    dispatchVaultMessage({
      type: 'auth_success',
      chain: SUI_LOCALNET_CHAIN,
      address: '0xlocal',
    })

    return promise
  }

  it('exposes wallet identity and current chains', () => {
    const wallet = new EveVaultWallet()

    expect(wallet.version).toBe('1.0.0')
    expect(wallet.name).toBe('Eve Vault')
    expect(wallet.icon).toMatch(/^data:image\/png;base64,/)
    expect(wallet.chains).toEqual([SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN])
  })

  it('connects to localnet auth success and supports silent reconnect when accounts exist', async () => {
    const wallet = new EveVaultWallet()

    await expect(connectLocalnet(wallet)).resolves.toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ address: '0xlocal' }),
      ]),
    })

    vi.mocked(window.postMessage).mockClear()
    await expect(
      wallet.features[StandardConnect].connect({ silent: true }),
    ).resolves.toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ address: '0xlocal' }),
      ]),
    })
    expect(window.postMessage).not.toHaveBeenCalled()
  })

  it('rejects connect when the auth response is not successful', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()

    dispatchVaultMessage({
      type: 'auth_error',
      error: { message: 'Authentication denied' },
    })

    await expect(promise).rejects.toThrow('Authentication denied')
  })

  it('uses a generic connect error message when auth failure omits a message', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()

    dispatchVaultMessage({
      type: 'auth_error',
      error: {},
    })

    await expect(promise).rejects.toThrow('Authentication failed')
  })

  it('rejects connect when no auth response arrives before the timeout', async () => {
    vi.useFakeTimers()
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()
    const expectation = expect(promise).rejects.toThrow(
      'Connection request timed out',
    )

    await vi.advanceTimersByTimeAsync(APPROVAL_TIMEOUT_MS)

    await expectation
  })

  it('rejects connect when auth_success cannot be resolved into accounts', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()

    dispatchVaultMessage({
      type: 'auth_success',
      chain: SUI_LOCALNET_CHAIN,
    })

    await expect(promise).rejects.toThrow(
      'Localnet auth_success missing address',
    )
  })

  it('ignores unrelated connect messages until the matching auth response arrives', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()

    window.dispatchEvent(new MessageEvent('message'))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Elsewhere',
          id: 'request-id',
          type: 'auth_error',
          error: { message: 'ignored wrong source' },
        },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'other-request',
          type: 'auth_error',
          error: { message: 'ignored wrong id' },
        },
      }),
    )
    dispatchVaultMessage({
      type: 'auth_success',
      chain: SUI_LOCALNET_CHAIN,
      address: '0xlocal',
    })

    await expect(promise).resolves.toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ address: '0xlocal' }),
      ]),
    })
  })

  it('ignores a same-origin connect response from a different window source', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[StandardConnect].connect()

    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    // Shares the page origin but comes from the iframe window, so it must not be
    // able to inject account metadata into the connect flow.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: {
          __from: 'Eve Vault',
          id: 'request-id',
          type: 'auth_success',
          chain: SUI_LOCALNET_CHAIN,
          address: '0xspoofed',
        },
      }),
    )
    // The genuine same-window response still settles the connect.
    dispatchVaultMessage({
      type: 'auth_success',
      chain: SUI_LOCALNET_CHAIN,
      address: '0xlocal',
    })

    await expect(promise).resolves.toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ address: '0xlocal' }),
      ]),
    })
  })

  it('emits chain and feature changes to subscribed listeners', () => {
    const wallet = new EveVaultWallet()
    const listener = vi.fn()
    const unsubscribe = wallet.features[StandardEvents].on('change', listener)
    const features = { 'test:feature': { version: '1.0.0' } }

    wallet.setChain(SUI_DEVNET_CHAIN)
    wallet.setChain(SUI_DEVNET_CHAIN)
    wallet.setFeatures(features)
    unsubscribe()
    wallet.setChain(SUI_TESTNET_CHAIN)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        chains: [SUI_DEVNET_CHAIN],
      }),
    )
    expect(listener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        features,
      }),
    )
  })

  it('logs listener errors and continues notifying remaining listeners', () => {
    const wallet = new EveVaultWallet()
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed')
    })
    const secondListener = vi.fn()

    wallet.features[StandardEvents].on('change', throwingListener)
    wallet.features[StandardEvents].on('change', secondListener)

    wallet.setChain(SUI_DEVNET_CHAIN)

    expect(throwingListener).toHaveBeenCalled()
    expect(secondListener).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      'Error in wallet event listener',
      expect.any(Error),
    )
  })

  it('revokes dApp permission and emits one account change when disconnecting', async () => {
    const wallet = new EveVaultWallet()
    await connectLocalnet(wallet)
    const listener = vi.fn()
    wallet.features[StandardEvents].on('change', listener)

    vi.mocked(window.postMessage).mockClear()
    const disconnect = wallet.features[StandardDisconnect].disconnect()

    expect(lastPostedMessage()).toEqual({
      __to: 'Eve Vault',
      id: 'request-id',
      type: WalletStandardMessageTypes.DISCONNECT,
    })

    dispatchVaultMessage({ type: 'disconnect_success' })
    await disconnect

    // Repeated disconnects still revoke stored origin permission, but should
    // not emit another account-change event once accounts are already cleared.
    vi.mocked(window.postMessage).mockClear()
    const repeatedDisconnect = wallet.features[StandardDisconnect].disconnect()

    expect(lastPostedMessage()).toEqual({
      __to: 'Eve Vault',
      id: 'request-id',
      type: WalletStandardMessageTypes.DISCONNECT,
    })

    dispatchVaultMessage({ type: 'disconnect_success' })
    await repeatedDisconnect

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: [],
      }),
    )
  })

  it('keeps accounts connected when permission revocation fails', async () => {
    const wallet = new EveVaultWallet()
    await connectLocalnet(wallet)
    const listener = vi.fn()
    wallet.features[StandardEvents].on('change', listener)

    const disconnect = wallet.features[StandardDisconnect].disconnect()
    dispatchVaultMessage({
      type: 'disconnect_error',
      error: { message: 'revocation failed' },
    })

    await expect(disconnect).rejects.toThrow('revocation failed')
    expect(wallet.accounts).toEqual(
      expect.arrayContaining([expect.objectContaining({ address: '0xlocal' })]),
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it('signs a personal message by posting the expected request and mapping the response', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[SuiSignPersonalMessage].signPersonalMessage(
      {
        message: new Uint8Array([1, 2]),
        account: { address: '0xaccount' },
      } as never,
    )

    expect(lastPostedMessage()).toEqual({
      __to: 'Eve Vault',
      id: 'request-id',
      action: 'sign_personal_message',
      message: new Uint8Array([1, 2]),
      account: { address: '0xaccount' },
    })

    dispatchVaultMessage({
      type: 'sign_success',
      bytes: 'message-bytes',
      signature: 'message-signature',
    })

    await expect(promise).resolves.toEqual({
      bytes: 'message-bytes',
      signature: 'message-signature',
    })
  })

  it('signs a transaction using the current chain when input has no chain', async () => {
    const wallet = new EveVaultWallet()
    const transaction = makeTransaction()
    const promise = wallet.features[SuiSignTransaction].signTransaction({
      transaction,
      account: { address: '0xaccount' },
    } as never)

    await vi.waitFor(() => {
      expect(lastPostedMessage()).toEqual({
        __to: 'Eve Vault',
        id: 'request-id',
        action: 'sign_transaction',
        transaction: 'tx-json',
        account: { address: '0xaccount' },
        chain: SUI_TESTNET_CHAIN,
      })
    })

    dispatchVaultMessage({
      type: 'sign_success',
      bytes: 'tx-bytes',
      signature: 'tx-signature',
    })

    await expect(promise).resolves.toEqual({
      bytes: 'tx-bytes',
      signature: 'tx-signature',
    })
  })

  it('signs and executes a transaction using the explicit input chain', async () => {
    const wallet = new EveVaultWallet()
    const transaction = makeTransaction('execute-json')
    const result = { digest: 'digest', effects: 'effects' }
    const promise = wallet.features[
      SuiSignAndExecuteTransaction
    ].signAndExecuteTransaction({
      transaction,
      account: { address: '0xaccount' },
      chain: SUI_DEVNET_CHAIN,
    } as never)

    await vi.waitFor(() => {
      expect(lastPostedMessage()).toEqual({
        __to: 'Eve Vault',
        id: 'request-id',
        action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        transaction: 'execute-json',
        account: { address: '0xaccount' },
        chain: SUI_DEVNET_CHAIN,
      })
    })

    dispatchVaultMessage({
      type: 'sign_and_execute_transaction_success',
      result,
    })

    await expect(promise).resolves.toBe(result)
  })

  it('signs and executes a transaction using the current chain when input has no chain', async () => {
    const wallet = new EveVaultWallet()
    const transaction = makeTransaction('execute-current-chain-json')
    const result = { digest: 'digest', effects: 'effects' }
    const promise = wallet.features[
      SuiSignAndExecuteTransaction
    ].signAndExecuteTransaction({
      transaction,
      account: { address: '0xaccount' },
    } as never)

    await vi.waitFor(() => {
      expect(lastPostedMessage()).toEqual({
        __to: 'Eve Vault',
        id: 'request-id',
        action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        transaction: 'execute-current-chain-json',
        account: { address: '0xaccount' },
        chain: SUI_TESTNET_CHAIN,
      })
    })

    dispatchVaultMessage({
      type: 'sign_and_execute_transaction_success',
      result,
    })

    await expect(promise).resolves.toBe(result)
  })

  it('signs a sponsored transaction with metadata when any metadata field is present', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[
      EVEFRONTIER_SPONSORED_TRANSACTION
    ].signSponsoredTransaction({
      txAction: 'mine',
      assembly: '1',
      assemblyType: 'type',
      metadata: {
        name: 'Name',
        description: undefined,
        url: undefined,
      },
    })

    expect(lastPostedMessage()).toEqual({
      __to: 'Eve Vault',
      id: 'request-id',
      action: WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
      message: {
        action: 'mine',
        assembly: '1',
        assemblyType: 'type',
        metadata: {
          name: 'Name',
          description: undefined,
          url: undefined,
        },
      },
    })

    dispatchVaultMessage({
      type: 'sign_success',
      digest: 'digest',
      effects: 'effects',
    })

    await expect(promise).resolves.toEqual({
      digest: 'digest',
      effects: 'effects',
    })
  })

  it('omits sponsored transaction metadata when metadata has no populated fields', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[
      EVEFRONTIER_SPONSORED_TRANSACTION
    ].signSponsoredTransaction({
      txAction: 'mine',
      assembly: '1',
      assemblyType: 'type',
      metadata: {},
    })

    expect(lastPostedMessage()).toEqual({
      __to: 'Eve Vault',
      id: 'request-id',
      action: WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
      message: {
        action: 'mine',
        assembly: '1',
        assemblyType: 'type',
      },
    })

    dispatchVaultMessage({
      type: 'sign_success',
      digest: 'digest',
      effects: 'effects',
    })

    await expect(promise).resolves.toEqual({
      digest: 'digest',
      effects: 'effects',
    })
  })

  it('normalizes sponsored transaction assembly ids to strings', async () => {
    const wallet = new EveVaultWallet()
    const promise = wallet.features[
      EVEFRONTIER_SPONSORED_TRANSACTION
    ].signSponsoredTransaction({
      txAction: 'mine',
      assembly: 1 as unknown as string,
      assemblyType: 'type',
    })

    expect(lastPostedMessage()).toMatchObject({
      message: {
        assembly: '1',
      },
    })

    dispatchVaultMessage({
      type: 'sign_success',
      digest: 'digest',
      effects: 'effects',
    })

    await expect(promise).resolves.toEqual({
      digest: 'digest',
      effects: 'effects',
    })
  })
})
