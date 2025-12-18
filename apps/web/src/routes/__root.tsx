import { Layout, NotFoundScreen } from "@evevault/shared/components";
import { useDocumentTitle } from "@evevault/shared/router";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RouteErrorBoundary } from "../lib/router/errorBoundary";
import { RouteContextProvider } from "../lib/router/routeContext";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
  errorComponent: RouteErrorBoundary,
});

function RootComponent() {
  useDocumentTitle();

  return (
    <RouteContextProvider>
      <Layout>
        <Outlet />
      </Layout>
    </RouteContextProvider>
  );
}
