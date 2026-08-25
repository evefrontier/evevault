import { SUI_DEVNET_CHAIN, SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockListOwnedObjects = vi.fn()

vi.mock('#/sui', () => ({
  createSuiClient: vi.fn(() => ({
    core: { listOwnedObjects: mockListOwnedObjects },
  })),
}))

vi.mock('#/utils', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('@mysten/sui/transactions', () => ({
  Transaction: { from: vi.fn() },
}))

import { Transaction } from '@mysten/sui/transactions'
import {
  assertAliasEnforced,
  invalidateAliasEnforcement,
  isAliasEnforcementError,
} from '#/wallet/aliasEnforcement'

const OWNER = `0x${'a'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`

function objectsWith(aliases: string[]) {
  return {
    objects: [{ objectId: '0x1', json: { aliases: { contents: aliases } } }],
  }
}

function stubDecodedModule(module: string) {
  vi.mocked(Transaction.from).mockReturnValue({
    getData: () => ({ commands: [{ MoveCall: { package: '0x2', module } }] }),
  } as never)
}

beforeEach(() => {
  invalidateAliasEnforcement()
  mockListOwnedObjects.mockReset()
  vi.mocked(Transaction.from).mockReset()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('assertAliasEnforced', () => {
  it('throws when the owner has no non-self alias', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([OWNER]))
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'TransactionData',
        msgBytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'alias_enforcement_required' })
  })

  it('resolves when a distinct alias exists', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([ALIAS]))
    stubDecodedModule('coin')
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'TransactionData',
        msgBytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined()
  })

  it('bypasses an address-alias setup transaction even when unsatisfied', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([OWNER]))
    stubDecodedModule('address_alias')
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'TransactionData',
        msgBytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined()
    expect(mockListOwnedObjects).not.toHaveBeenCalled()
  })

  it('always enforces personal messages (no bypass)', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([OWNER]))
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'PersonalMessage',
        msgBytes: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({ code: 'alias_enforcement_required' })
  })

  it('is a no-op on localnet', async () => {
    await expect(
      assertAliasEnforced({
        chain: SUI_LOCALNET_CHAIN,
        owner: OWNER,
        scope: 'TransactionData',
        msgBytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined()
    expect(mockListOwnedObjects).not.toHaveBeenCalled()
  })

  it('is a no-op when the flag is disabled', async () => {
    vi.stubEnv('VITE_ENFORCE_ADDRESS_ALIAS', 'false')
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'TransactionData',
        msgBytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined()
    expect(mockListOwnedObjects).not.toHaveBeenCalled()
  })

  it('caches a satisfied result and re-reads after invalidation', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([ALIAS]))
    stubDecodedModule('coin')
    const params = {
      chain: SUI_DEVNET_CHAIN,
      owner: OWNER,
      scope: 'TransactionData' as const,
      msgBytes: new Uint8Array([1]),
    }

    await assertAliasEnforced(params)
    await assertAliasEnforced(params)
    expect(mockListOwnedObjects).toHaveBeenCalledTimes(1)

    invalidateAliasEnforcement(OWNER, SUI_DEVNET_CHAIN)
    await assertAliasEnforced(params)
    expect(mockListOwnedObjects).toHaveBeenCalledTimes(2)
  })
})

describe('isAliasEnforcementError', () => {
  it('matches by error code and ignores unrelated errors', () => {
    expect(
      isAliasEnforcementError({ code: 'alias_enforcement_required' }),
    ).toBe(true)
    expect(isAliasEnforcementError(new Error('nope'))).toBe(false)
    expect(isAliasEnforcementError(null)).toBe(false)
  })
})
