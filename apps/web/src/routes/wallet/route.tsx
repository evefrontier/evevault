import { requireAuth } from '@evevault/shared/router'
import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout route guarding the entire /wallet subtree.
 * beforeLoad runs parent-first on every navigation, so child routes
 * don't need their own requireAuth call.
 */
export const Route = createFileRoute('/wallet')({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: Outlet,
})
