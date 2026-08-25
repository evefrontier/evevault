import {
  AliasEnforcementError,
  type AliasEnforcementStatus,
  checkAliasEnforcement,
  isAddressAliasCall,
} from '@evefrontier/wallet-core/address-alias'
import type { IntentScope } from '@mysten/sui/cryptography'
import { Transaction } from '@mysten/sui/transactions'
import type { SuiChain } from '@mysten/wallet-standard'
import { createSuiClient } from '#/sui'
import { isLocalnetChain } from '#/types/networks'
import { createLogger } from '#/utils'

const log = createLogger()

/**
 * Feature flag for address-alias enforcement. Defaults to ON; set
 * `VITE_ENFORCE_ADDRESS_ALIAS=false` in an app's env to disable both the UX
 * gate and the signing backstop (kill-switch for rollout).
 */
export function isAddressAliasEnforcementEnabled(): boolean {
  return import.meta.env.VITE_ENFORCE_ADDRESS_ALIAS !== 'false'
}

/**
 * Module-level cache of on-chain enforcement status keyed by owner+chain. Only
 * `satisfied` results are treated as durable (aliases don't disappear in normal
 * use); unsatisfied results are always re-read so a freshly registered alias is
 * picked up. Cleared via {@link invalidateAliasEnforcement} after registration.
 */
const statusCache = new Map<string, AliasEnforcementStatus>()

const cacheKey = (owner: string, chain: string) => `${owner}:${chain}`

/** Clears cached status for one owner+chain, or the whole cache when no owner is given. */
export function invalidateAliasEnforcement(
  owner?: string,
  chain?: string,
): void {
  if (!owner || !chain) {
    statusCache.clear()
    return
  }
  statusCache.delete(cacheKey(owner, chain))
}

/** True for wallet-core's `AliasEnforcementError` (also matches across module copies via its code). */
export function isAliasEnforcementError(err: unknown): boolean {
  return (
    err instanceof AliasEnforcementError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === 'alias_enforcement_required')
  )
}

/** True when the transaction bytes are an address-alias setup call (enable/add/remove). */
function isAliasSetupBytes(msgBytes: Uint8Array): boolean {
  try {
    const { commands } = Transaction.from(msgBytes).getData()
    return commands.some((command) => isAddressAliasCall(command))
  } catch {
    // Undecodable bytes are never treated as an alias-setup exemption.
    return false
  }
}

/**
 * Resolves the enforcement status for an owner on a chain, reading on-chain
 * state via wallet-core. Cached once satisfied.
 */
export async function resolveAliasEnforcementStatus(
  owner: string,
  chain: SuiChain,
): Promise<AliasEnforcementStatus> {
  const key = cacheKey(owner, chain)
  const cached = statusCache.get(key)
  if (cached?.satisfied) {
    return cached
  }
  const status = await checkAliasEnforcement(createSuiClient(chain), owner)
  statusCache.set(key, status)
  return status
}

export interface AssertAliasEnforcedParams {
  chain: SuiChain | string | null | undefined
  owner: string | null | undefined
  scope: IntentScope
  msgBytes: Uint8Array
}

/**
 * Signing backstop: throws `AliasEnforcementError` when the owner has no
 * enforceable alias. No-op when the feature flag is off, on localnet, when the
 * owner is unknown, or when the transaction is an alias-setup call (so the
 * first alias can still be registered). Personal messages are always enforced.
 */
export async function assertAliasEnforced({
  chain,
  owner,
  scope,
  msgBytes,
}: AssertAliasEnforcedParams): Promise<void> {
  if (!isAddressAliasEnforcementEnabled()) return
  if (!chain || isLocalnetChain(chain)) return
  if (!owner) return

  if (scope === 'TransactionData' && isAliasSetupBytes(msgBytes)) {
    return
  }

  const status = await resolveAliasEnforcementStatus(owner, chain as SuiChain)
  if (!status.satisfied) {
    log.info('Blocking sign: address alias enforcement not satisfied', {
      owner,
      reason: status.reason,
    })
    throw new AliasEnforcementError(owner, status)
  }
}
