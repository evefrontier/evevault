import { SettingsScreen, useAuthStore } from '@evevault/shared'
import { requireAuth } from '@evevault/shared/router'
import { EXTENSION_ROUTES } from '@evevault/shared/utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { APP_VERSION } from '@/lib/appVersion'

function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  if (!user) {
    return null
  }

  return (
    <SettingsScreen
      user={user}
      version={APP_VERSION}
      onBack={() => navigate({ to: EXTENSION_ROUTES.HOME })}
      onLocalnetSettingsClick={() =>
        navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
      }
    />
  )
}

export const Route = createFileRoute('/settings')({
  beforeLoad: () => requireAuth(),
  component: SettingsPage,
})
