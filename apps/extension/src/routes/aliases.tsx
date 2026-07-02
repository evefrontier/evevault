import { AliasesScreen, useAuthStore } from '@evevault/shared'
import { requireAuth } from '@evevault/shared/router'
import { useContextStore } from '@evevault/shared/stores/contextStore'
import { EXTENSION_ROUTES } from '@evevault/shared/utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

function AliasesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chain } = useContextStore()

  const handleNavigateBack = () => {
    navigate({ to: EXTENSION_ROUTES.HOME })
  }

  if (!user || !chain) {
    return null
  }

  return (
    <div className="flex flex-col gap-10">
      <AliasesScreen onBack={handleNavigateBack} user={user} />
    </div>
  )
}

export const Route = createFileRoute('/aliases')({
  beforeLoad: () => requireAuth(),
  component: AliasesPage,
})
