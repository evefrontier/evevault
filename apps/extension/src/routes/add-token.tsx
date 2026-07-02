import { AddTokenScreen, useAuthStore, useContext } from '@evevault/shared'
import { requireAuth } from '@evevault/shared/router'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

function AddTokenPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chain } = useContext()

  const handleNavigateBack = () => {
    navigate({ to: '/' })
  }

  if (!user) {
    return null
  }

  // Note: Layout is provided by popup entrypoint, so we only render content
  // here. AddTokenScreen renders its own SubpageHeader.
  return (
    <div className="flex flex-col gap-10">
      <AddTokenScreen
        user={user}
        chain={chain || null}
        onSuccess={handleNavigateBack}
        onCancel={handleNavigateBack}
      />
    </div>
  )
}

export const Route = createFileRoute('/add-token')({
  beforeLoad: () => requireAuth(),
  component: AddTokenPage,
})
