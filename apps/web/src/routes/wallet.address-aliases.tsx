import { useAuthStore, useContextStore } from '@evevault/shared'
import { AddressAliasesScreen } from '@evevault/shared/screens'
import { WEB_ROUTES } from '@evevault/shared/utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

function AddressAliasesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chain } = useContextStore()

  const handleBack = () => {
    navigate({ to: WEB_ROUTES.WALLET })
  }

  if (!user || !chain) {
    return null
  }

  return <AddressAliasesScreen onBack={handleBack} user={user} />
}

export const Route = createFileRoute('/wallet/address-aliases')({
  component: AddressAliasesPage,
})
