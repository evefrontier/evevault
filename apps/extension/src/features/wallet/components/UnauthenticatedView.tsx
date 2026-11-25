import type { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  Button,
  Heading,
  ResetVaultDialog,
  SignInContextLine,
} from '@evevault/shared/components'
import Icon from '@evevault/shared/components/Icon'
import { useState } from 'react'

/**
 * Leaves the dev-mode toggle visible while signed out so testers can switch
 * tenants and localnet behavior before starting auth.
 */
function DevModeButton({
  devMode,
  onClick,
}: {
  devMode: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="secondary"
      size="small"
      className="absolute! bottom-4 right-4"
      onClick={onClick}
    >
      <Icon name={devMode ? 'Eye' : 'HideEye'} color="#ED4136" size="small" />
    </Button>
  )
}

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
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>Sign in</Heading>
        </header>
        <div className="w-full max-w-75">
          <Button size="fill" onClick={onLoginClick} disabled={authLoading}>
            {authLoading ? 'Loading...' : 'Login'}
          </Button>
        </div>
        <SignInContextLine
          tenant={{
            currentTenantId: tenantId,
            availableTenantIds,
            onServerChange: onTenantChange,
          }}
        />
        {isPinSet && (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="text-sm underline text-grey-neutral hover:text-neutral focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Reset vault
          </button>
        )}
      </section>
      <DevModeButton devMode={devMode} onClick={onDevModeToggle} />
      <ResetVaultDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onResetComplete={onResetComplete}
      />
    </div>
  )
}
