import type { TenantId } from '@evefrontier/wallet-core/definitions'
import { Button, Heading, TenantSelector } from '@evevault/shared/components'
import Icon from '@evevault/shared/components/Icon'
import { createLogger } from '@evevault/shared/utils'

const log = createLogger()

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

export function UnauthenticatedView({
  authLoading,
  availableTenantIds,
  tenantId,
  isPinSet,
  devMode,
  onLoginClick,
  onTenantChange,
  onResetVault,
  onDevModeToggle,
}: {
  authLoading: boolean
  availableTenantIds: TenantId[]
  tenantId: TenantId
  isPinSet: boolean
  devMode: boolean
  onLoginClick: () => Promise<void>
  onTenantChange: (tenantId: string) => void
  onResetVault: () => Promise<void>
  onDevModeToggle: () => void
}) {
  const handleResetVaultClick = async () => {
    try {
      await onResetVault()
    } catch (error) {
      log.error('Failed to reset vault', error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>Sign in</Heading>
        </header>
        <div className="w-full max-w-[300px]">
          <Button size="fill" onClick={onLoginClick} disabled={authLoading}>
            {authLoading ? 'Loading...' : 'Login'}
          </Button>
        </div>
        <TenantSelector
          currentTenantId={tenantId}
          availableTenantIds={availableTenantIds}
          onServerChange={onTenantChange}
        />
        {isPinSet && (
          <button
            type="button"
            onClick={() => void handleResetVaultClick()}
            className="text-sm underline text-grey-neutral hover:text-neutral focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Reset Vault
          </button>
        )}
      </section>
      <DevModeButton devMode={devMode} onClick={onDevModeToggle} />
    </div>
  )
}
