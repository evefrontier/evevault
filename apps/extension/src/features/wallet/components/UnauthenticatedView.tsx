import type { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  AuthShellLink,
  ResetVaultDialog,
  SignInView,
} from '@evevault/shared/components'
import { useState } from 'react'

/**
 * Isolates the signed-out popup state so login, tenant selection, vault reset,
 * and dev mode controls do not add branches to the root popup component.
 */
export function UnauthenticatedView({
  authLoading,
  availableTenantIds,
  tenantId,
  isPinSet,
  devMode,
  onLoginClick,
  onTenantChange,
  onResetComplete,
  onDevModeToggle,
}: {
  authLoading: boolean
  availableTenantIds: TenantId[]
  tenantId: TenantId
  isPinSet: boolean
  devMode: boolean
  onLoginClick: () => Promise<void>
  onTenantChange: (tenantId: string) => void
  onResetComplete: () => void
  onDevModeToggle: () => void
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  return (
    <SignInView
      loading={authLoading}
      onLogin={onLoginClick}
      tenant={{
        currentTenantId: tenantId,
        availableTenantIds,
        onServerChange: onTenantChange,
      }}
      devMode={devMode}
      onDevModeToggle={onDevModeToggle}
      footerStart={
        isPinSet && (
          <AuthShellLink onClick={() => setShowResetConfirm(true)}>
            Reset vault
          </AuthShellLink>
        )
      }
    >
      <ResetVaultDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onResetComplete={onResetComplete}
      />
    </SignInView>
  )
}
