import {
  isLocalnetChain,
  SendTokenScreen,
  useAuthStore,
} from '@evevault/shared'
import type { SendTokenSearch } from '@evevault/shared/router'
import { localnetKeyService } from '@evevault/shared/services/keeperService'
import { useContextStore } from '@evevault/shared/stores'
import { EXTENSION_ROUTES } from '@evevault/shared/utils'
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'

function SendTokenPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { coinType } = useSearch({ from: '/send-token' })

  const handleNavigateBack = () => {
    navigate({ to: '/' })
  }

  // SendTokenScreen renders its own SubpageHeader; user is optional because
  // localnet has no zkLogin user (the header falls back to the active address).
  return (
    <div className="flex flex-col gap-10">
      <SendTokenScreen
        coinType={coinType}
        user={user}
        onCancel={handleNavigateBack}
      />
    </div>
  )
}

export const Route = createFileRoute('/send-token')({
  beforeLoad: async () => {
    const { user } = useAuthStore.getState()
    const { chain } = useContextStore.getState()

    if (isLocalnetChain(chain)) {
      const address = await localnetKeyService.getAddress().catch(() => null)
      if (!address) {
        throw redirect({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
      }
      return
    }

    if (!user) {
      throw redirect({ to: '/' })
    }
  },
  component: SendTokenPage,
  validateSearch: (search: Record<string, unknown>): SendTokenSearch => {
    const coinType = (search.coinType as string) || ''
    // Redirect to home if coinType is missing
    if (!coinType) {
      throw redirect({ to: '/' })
    }
    return { coinType }
  },
})
