import { AliasesScreen, useAuthStore, useContextStore } from '@evevault/shared'
import { requireAuth } from '@evevault/shared/router'
import { WEB_ROUTES } from '@evevault/shared/utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

function AliasesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chain } = useContextStore()

  const handleBack = () => {
    navigate({ to: WEB_ROUTES.WALLET })
  }

  if (!user || !chain) {
    return null
  }

  return <AliasesScreen onBack={handleBack} />
}

export const Route = createFileRoute('/wallet/aliases')({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: AliasesPage,
})
