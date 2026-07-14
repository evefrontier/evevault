import { AddTokenScreen, useAuthStore, useContext } from '@evevault/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

function AddTokenPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chain } = useContext()

  const handleSuccess = () => {
    navigate({ to: '/wallet' })
  }

  return (
    <AddTokenScreen
      user={user}
      chain={chain || null}
      onSuccess={handleSuccess}
      onCancel={() => navigate({ to: '/wallet' })}
    />
  )
}

export const Route = createFileRoute('/wallet/add-token')({
  component: AddTokenPage,
})
