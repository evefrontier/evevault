import { Layout, NotFoundScreen } from "@evevault/shared/components";
import { useVaultAutoLock } from '@evevault/shared/hooks'
import { useDocumentTitle, useDocumentTitle } from '@evevault/shared/router';
import { NotFoundScreen } from '@evevault/shared/screens'
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { PwaInstallBanner } from "@/features/pwa/PwaInstallBanner";
import { RouteErrorBoundary, RouteErrorBoundary } from '@/lib/router/errorBoundary';
import { RouteContextProvider } from "@/lib/router/routeContext";
import { TenantUrlSync } from "@/lib/tenantUrlSync";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
  errorComponent: RouteErrorBoundary,
})

function RootComponent() {
  useDocumentTitle()
  useVaultAutoLock()

  return (
    <RouteContextProvider>
      <TenantUrlSync />
      <Layout>
        <Outlet />
      </Layout>
      <PwaInstallBanner />
    </RouteContextProvider>
  )
}
