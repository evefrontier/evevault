import { Layout, NotFoundScreen } from '@evevault/shared/components'
import { useVaultAutoLock } from '@evevault/shared/hooks'
import { useDocumentTitle } from '@evevault/shared/router'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { RouteErrorBoundary } from '@/lib/router/errorBoundary'
import { TenantUrlSync } from '@/lib/tenantUrlSync'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
  errorComponent: RouteErrorBoundary,
})

function RootComponent() {
  useDocumentTitle()
  useVaultAutoLock()

  return (
    <>
      <TenantUrlSync />
      <Layout>
        <Outlet />
      </Layout>
    </>
  )
}
