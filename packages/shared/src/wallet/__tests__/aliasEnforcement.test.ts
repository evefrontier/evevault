import { SUI_DEVNET_CHAIN, SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  isAliasEnforcementError,
  resolveEnforcementOverride,
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
  mockListOwnedObjects.mockReset()
  vi.mocked(Transaction.from).mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('assertAliasEnforced', () => {
  it('is a no-op when the feature flag is staged off', async () => {
    vi.stubEnv('VITE_ADDRESS_ALIAS_ENFORCEMENT', 'false')
    mockListOwnedObjects.mockResolvedValue(objectsWith([OWNER]))
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

  it('never gates personal messages (off-chain signatures)', async () => {
    mockListOwnedObjects.mockResolvedValue(objectsWith([OWNER]))
    await expect(
      assertAliasEnforced({
        chain: SUI_DEVNET_CHAIN,
        owner: OWNER,
        scope: 'PersonalMessage',
        msgBytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined()
    expect(mockListOwnedObjects).not.toHaveBeenCalled()
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

  it('reads on-chain state fresh on every call (no caching)', async () => {
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

describe('resolveEnforcementOverride (break-glass, fail-closed)', () => {
  const NOW = 1_000_000

  it('accepts a well-formed, unexpired override', () => {
    expect(
      resolveEnforcementOverride(
        { reason: 'incident-123', until: NOW + 1000, actor: 'ops@eve' },
        NOW,
      ),
    ).toEqual({ reason: 'incident-123', until: NOW + 1000, actor: 'ops@eve' })
  })

  it('drops actor when it is not a string but keeps the override', () => {
    expect(
      resolveEnforcementOverride({ reason: 'x', until: NOW + 1 }, NOW),
    ).toEqual({ reason: 'x', until: NOW + 1, actor: undefined })
  })

  it('returns null for an expired override', () => {
    expect(
      resolveEnforcementOverride({ reason: 'x', until: NOW - 1 }, NOW),
    ).toBeNull()
  })

  it('returns null for malformed / missing claims', () => {
    expect(resolveEnforcementOverride(null, NOW)).toBeNull()
    expect(resolveEnforcementOverride('nope', NOW)).toBeNull()
    expect(resolveEnforcementOverride({ until: NOW + 1 }, NOW)).toBeNull()
    expect(
      resolveEnforcementOverride({ reason: '', until: NOW + 1 }, NOW),
    ).toBeNull()
    expect(resolveEnforcementOverride({ reason: 'x' }, NOW)).toBeNull()
    expect(
      resolveEnforcementOverride({ reason: 'x', until: 'soon' }, NOW),
    ).toBeNull()
  })
})
