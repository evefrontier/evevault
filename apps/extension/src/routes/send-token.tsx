import {
  isLocalnetChain,
  SendTokenScreen,
  useAuthStore,
} from '@evevault/shared'
import { getHeaderIdentity } from '@evevault/shared/auth'
import { SubpageHeader } from '@evevault/shared/components'
import type { SendTokenSearch } from '@evevault/shared/router'
import { localnetKeyService } from '@evevault/shared/services/keeperService'
import { useContextStore } from '@evevault/shared/stores'
import { EXTENSION_ROUTES } from '@evevault/shared/utils'
import { useActiveSuiAddress } from '@evevault/shared/wallet'
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'

function SendTokenPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const activeAddress = useActiveSuiAddress()
  const { coinType } = useSearch({ from: '/send-token' })

  const handleNavigateBack = () => {
    navigate({ to: '/' })
  }

  // On localnet there is no zkLogin user; fall back to the active address.
  const identity = user ? getHeaderIdentity(user) : { email: '', address: '' }

  return (
    <div className="flex flex-col gap-10">
      <SubpageHeader
        title="Transfer token"
        email={identity.email}
        address={activeAddress ?? identity.address}
        onBack={handleNavigateBack}
      />
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
