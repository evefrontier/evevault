import { SendTokenScreen, useAuthStore } from '@evevault/shared'
import type { SendTokenSearch } from '@evevault/shared/router'
import { requireAuth } from '@evevault/shared/router'
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'

function SendTokenPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { coinType } = useSearch({ from: '/wallet/send-token' })

  const handleCancel = () => {
    navigate({ to: '/wallet' })
  }

  if (!user) {
    return null
  }

  return (
    <SendTokenScreen coinType={coinType} user={user} onCancel={handleCancel} />
  )
}

export const Route = createFileRoute('/wallet/send-token')({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: SendTokenPage,
  validateSearch: (search: Record<string, unknown>): SendTokenSearch => {
    const coinType = (search.coinType as string) || ''
    // Redirect to wallet if coinType is missing
    if (!coinType) {
      throw redirect({ to: '/wallet' })
    }
    return { coinType }
  },
})
