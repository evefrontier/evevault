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
 * App-side rollout gate for the whole alias-enforcement feature. Owned by the
 * build/env. When on, enforcement applies — subject to the ops break-glass
 * ({@link isEnforcementOverridden}). Defaults ON; set
 * `VITE_ADDRESS_ALIAS_ENFORCEMENT=false` to stage the feature off in an env.
 */
export function isAliasEnforcementFeatureEnabled(): boolean {
  return import.meta.env.VITE_ADDRESS_ALIAS_ENFORCEMENT !== 'false'
}

/**
 * Ops break-glass override for the compliance-mandated alias enforcement. There
 * is deliberately no env/build-time off-switch: enforcement is always on (see
 * {@link assertAliasEnforced}). The only way to suspend it is an ops-issued,
 * signed, expiring override — every use of which is logged.
 */
export interface EnforcementOverride {
  /** Ops-readable justification, recorded in the log. */
  reason: string
  /** Epoch ms after which the override is ignored (fail-closed on expiry). */
  until: number
  /** Optional identifier of who authorised it, for the audit trail. */
  actor?: string
}

/**
 * Validates a raw ops override claim. Fail-closed: any non-object, missing
 * `reason`, or missing/expired `until` resolves to `null` (i.e. enforce), so a
 * malformed override can never weaken the control.
 */
export function resolveEnforcementOverride(
  claim: unknown,
  now: number,
): EnforcementOverride | null {
  if (typeof claim !== 'object' || claim === null) return null
  const { reason, until, actor } = claim as Record<string, unknown>
  if (typeof reason !== 'string' || reason.length === 0) return null
  if (typeof until !== 'number' || !Number.isFinite(until) || until <= now) {
    return null
  }
  return { reason, until, actor: typeof actor === 'string' ? actor : undefined }
}

/**
 * Phase 2 seam for the break-glass. Returns the raw ops-issued override claim,
 * or `null` when none is active. Returning `null` keeps enforcement on.
 *
 * TODO(phase-2): source this from the signed `alias_enforcement_override` claim
 * on the authenticated zkLogin JWT (read via the auth store) so ops can engage
 * it without a client redeploy and the JWT signature makes it tamper-evident.
 */
function getEnforcementOverrideClaim(): unknown {
  return null
}

/**
 * True when a valid ops break-glass override is currently active for `owner`,
 * logging an audit line whenever one is engaged. Fail-closed: any missing,
 * malformed, or expired override resolves to `false` (enforce).
 */
export function isEnforcementOverridden(owner: string): boolean {
  const override = resolveEnforcementOverride(
    getEnforcementOverrideClaim(),
    Date.now(),
  )
  if (!override) return false
  log.warn('AUDIT address-alias enforcement overridden', {
    owner,
    reason: override.reason,
    until: override.until,
    actor: override.actor,
  })
  return true
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

/**
 * True when every command in the transaction is an address-alias call
 * (enable/add/remove). Empty or mixed command sets are false.
 */
function isAliasSetupBytes(msgBytes: Uint8Array): boolean {
  try {
    const { commands } = Transaction.from(msgBytes).getData()
    return (
      commands.length > 0 &&
      commands.every((command) => isAddressAliasCall(command))
    )
  } catch {
    // Undecodable bytes are never treated as an alias-setup exemption.
    return false
  }
}

/**
 * Reads current on-chain enforcement status for an owner on a chain via
 * wallet-core.
 */
export async function resolveAliasEnforcementStatus(
  owner: string,
  chain: SuiChain,
): Promise<AliasEnforcementStatus> {
  return checkAliasEnforcement(createSuiClient(chain), owner)
}

export interface AssertAliasEnforcedParams {
  chain: SuiChain | string | null | undefined
  owner: string | null | undefined
  scope: IntentScope
  msgBytes: Uint8Array
}

/**
 * Signing backstop: throws `AliasEnforcementError` when the owner has no
 * enforceable alias. Only on-chain transactions are gated. No-op when the
 * feature flag is off, on localnet, for non-transaction scopes (personal
 * messages are never gated), when the owner is unknown, when the transaction is
 * the alias-setup call itself (so the first alias can still be registered), or
 * when a valid ops break-glass override is active.
 */
export async function assertAliasEnforced({
  chain,
  owner,
  scope,
  msgBytes,
}: AssertAliasEnforcedParams): Promise<void> {
  if (!isAliasEnforcementFeatureEnabled()) return
  if (!chain || isLocalnetChain(chain)) return
  if (!owner) return

  // Only on-chain transactions are gated; off-chain signatures pass through.
  if (scope !== 'TransactionData') return

  // Exempt the alias-setup transaction so the first alias can be registered.
  if (isAliasSetupBytes(msgBytes)) return

  if (isEnforcementOverridden(owner)) return

  const status = await resolveAliasEnforcementStatus(owner, chain as SuiChain)
  if (!status.satisfied) {
    log.info('Blocking sign: address alias enforcement not satisfied', {
      owner,
      reason: status.reason,
    })
    throw new AliasEnforcementError(owner, status)
  }
}
