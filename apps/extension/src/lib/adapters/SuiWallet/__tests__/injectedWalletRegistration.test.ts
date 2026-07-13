import {
  registerWallet,
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EveVaultWallet } from '../index'
import { registerInjectedWallet } from '../injectedWalletRegistration'

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
    createLogger: vi.fn(() => logger),
  }
})

vi.mock('@mysten/wallet-standard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@mysten/wallet-standard')>()
  return {
    ...actual,
    registerWallet: vi.fn(),
  }
})

const REGISTRATION_KEY = '__evevault_registered__'
const mockRegisterWallet = vi.mocked(registerWallet)

function registrationWindow() {
  return window as Window & { [REGISTRATION_KEY]?: boolean }
}

describe('registerInjectedWallet', () => {
  beforeEach(() => {
    delete registrationWindow()[REGISTRATION_KEY]
    mockRegisterWallet.mockReset()
    vi.spyOn(window, 'postMessage').mockImplementation(() => undefined)
  })

  afterEach(() => {
    delete registrationWindow()[REGISTRATION_KEY]
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('registers the wallet once and asks for the persisted chain', () => {
    registerInjectedWallet()

    expect(mockRegisterWallet).toHaveBeenCalledWith(expect.any(EveVaultWallet))
    expect(registrationWindow()[REGISTRATION_KEY]).toBe(true)
    expect(window.postMessage).toHaveBeenCalledWith(
      { __to: 'Eve Vault', type: 'get_current_chain' },
      window.location.origin,
    )
  })

  it('skips registration when the wallet is already marked as registered', () => {
    registrationWindow()[REGISTRATION_KEY] = true

    registerInjectedWallet()

    expect(mockRegisterWallet).not.toHaveBeenCalled()
    expect(window.postMessage).not.toHaveBeenCalled()
  })

  it('logs registration failures without marking the wallet as registered', () => {
    mockRegisterWallet.mockImplementation(() => {
      throw new Error('registration failed')
    })

    registerInjectedWallet()

    expect(registrationWindow()[REGISTRATION_KEY]).toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to register wallet',
      expect.any(Error),
    )
  })

  it('applies wallet change messages from the page window', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    registerInjectedWallet()
    const wallet = mockRegisterWallet.mock.calls[0][0] as EveVaultWallet
    const setChain = vi.spyOn(wallet, 'setChain')
    const disconnect = vi.spyOn(wallet, 'disconnect')
    const setFeatures = vi.spyOn(wallet, 'setFeatures')
    const features = { 'test:feature': { version: '1.0.0' } }
    const listener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as EventListener

    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'change',
          payload: {
            chains: [SUI_DEVNET_CHAIN],
            accounts: [],
            features,
          },
        },
        source: window,
        origin: window.location.origin,
      }),
    )

    expect(setChain).toHaveBeenCalledWith(SUI_DEVNET_CHAIN)
    expect(disconnect).toHaveBeenCalled()
    expect(setFeatures).toHaveBeenCalledWith(features)
  })

  it('ignores wallet change messages from a different origin', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    registerInjectedWallet()
    const wallet = mockRegisterWallet.mock.calls[0][0] as EveVaultWallet
    const setChain = vi.spyOn(wallet, 'setChain')
    const listener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as EventListener

    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'change',
          payload: { chains: [SUI_DEVNET_CHAIN] },
        },
        source: window,
        origin: 'https://evil.example',
      }),
    )

    expect(setChain).not.toHaveBeenCalled()
  })

  it('ignores message events that are not wallet change messages', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    registerInjectedWallet()
    const wallet = mockRegisterWallet.mock.calls[0][0] as EveVaultWallet
    const setChain = vi.spyOn(wallet, 'setChain')
    const listener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as EventListener

    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'not-change',
          payload: {
            chains: [SUI_TESTNET_CHAIN],
          },
        },
        source: window,
      }),
    )

    expect(setChain).not.toHaveBeenCalled()
  })

  it('ignores wallet change messages that are not sent from the page window', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    registerInjectedWallet()
    const wallet = mockRegisterWallet.mock.calls[0][0] as EveVaultWallet
    const setChain = vi.spyOn(wallet, 'setChain')
    const listener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as EventListener

    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'change',
          payload: {
            chains: [SUI_TESTNET_CHAIN],
          },
        },
      }),
    )

    expect(setChain).not.toHaveBeenCalled()
  })

  it('treats missing and partial wallet change payloads as no-ops for absent fields', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    registerInjectedWallet()
    const wallet = mockRegisterWallet.mock.calls[0][0] as EveVaultWallet
    const setChain = vi.spyOn(wallet, 'setChain')
    const disconnect = vi.spyOn(wallet, 'disconnect')
    const setFeatures = vi.spyOn(wallet, 'setFeatures')
    const listener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === 'message',
    )?.[1] as EventListener

    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'change',
        },
        source: window,
      }),
    )
    listener(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          event: 'change',
          payload: {
            accounts: [{ address: '0xaccount' }],
          },
        },
        source: window,
      }),
    )

    expect(setChain).not.toHaveBeenCalled()
    expect(disconnect).not.toHaveBeenCalled()
    expect(setFeatures).not.toHaveBeenCalled()
  })
})
