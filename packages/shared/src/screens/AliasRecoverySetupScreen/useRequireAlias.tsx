import type React from 'react'
import { useRef, useState } from 'react'
import { Modal } from '#/components'
import {
  isEnforcementOverridden,
  resolveAliasEnforcementStatus,
  useWalletSigningContext,
} from '#/wallet'
import { AliasRecoverySetupScreen } from './AliasRecoverySetupScreen'

export interface UseRequireAliasResult {
  /**
   * Resolves `true` when the account may sign (non-zklogin, no sender, an ops
   * override is active, or a non-self alias already exists). Otherwise opens the
   * recovery setup modal and resolves `true` once an alias is registered, or
   * `false` if the user cancels. Await it before signing and bail on `false`.
   */
  ensureAlias: () => Promise<boolean>
  /** Render this in the component tree so the setup modal can appear. */
  aliasSetupModal: React.ReactNode
}

/**
 * Just-in-time address-alias gate. Callers invoke `ensureAlias()` right
 * before signing; the setup modal is shown when an on-chain lookup
 * finds no non-self alias for the zklogin account.
 */
export function useRequireAlias(): UseRequireAliasResult {
  const { mode, senderAddress, chain } = useWalletSigningContext()
  const [isOpen, setIsOpen] = useState(false)
  // Holds the pending ensureAlias() promise resolver across the async gap while
  // the modal is open, so onComplete/onCancel can settle the original call.
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const settle = (value: boolean) => {
    setIsOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(value)
  }

  const ensureAlias = async (): Promise<boolean> => {
    if (mode !== 'zklogin') {
      // Non-zklogin (localnet) accounts are never gated.
      return true
    }

    if (!senderAddress) {
      // No account to gate; let the downstream no-sender handling take over.
      return true
    }

    if (isEnforcementOverridden(senderAddress)) {
      // Ops break-glass active (audit-logged); mirror the signing backstop.
      return true
    }

    const status = await resolveAliasEnforcementStatus(senderAddress, chain)
    if (status.satisfied) {
      return true
    }

    return new Promise<boolean>((resolve) => {
      // A pending caller from a prior (still-open) invocation would otherwise be
      // orphaned when we overwrite the ref; settle it so it never hangs.
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setIsOpen(true)
    })
  }

  const aliasSetupModal: React.ReactNode = (
    <Modal isOpen={isOpen} size="large" onClose={() => settle(false)}>
      <AliasRecoverySetupScreen
        onComplete={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </Modal>
  )

  return { ensureAlias, aliasSetupModal }
}
