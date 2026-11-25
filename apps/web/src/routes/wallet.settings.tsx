import { SettingsScreen, useAuthStore } from '@evevault/shared'
import { WEB_ROUTES } from '@evevault/shared/utils'
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
      onBack={() => navigate({ to: WEB_ROUTES.WALLET })}
    />
  )
}

export const Route = createFileRoute('/wallet/settings')({
  component: SettingsPage,
})
