import { useDocumentTitle } from '@evevault/shared/router'
import { NotFoundScreen } from '@evevault/shared/screens'
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
})

function RootComponent() {
  useDocumentTitle()
  return <Outlet />
}
