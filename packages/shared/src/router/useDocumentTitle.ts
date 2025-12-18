import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import type { RouteMetaWithTitle } from "./types";

const hasTitle = (meta: unknown): meta is RouteMetaWithTitle => {
  return (
    typeof meta === "object" &&
    meta !== null &&
    "title" in meta &&
    typeof (meta as { title?: unknown }).title === "string"
  );
};

/**
 * Hook to update document title based on route meta
 * TanStack Router doesn't automatically update document.title, so we do it manually
 *
 * This hook can be used in the root route component to automatically update
 * the document title based on route meta configuration.
 *
 * @example
 * ```tsx
 * export const Route = createRootRoute({
 *   component: () => {
 *     useDocumentTitle();
 *     return <Outlet />;
 *   },
 * });
 * ```
 */
export function useDocumentTitle() {
  const router = useRouterState();
  const routeMeta = router.matches[router.matches.length - 1]?.meta;

  useEffect(() => {
    if (routeMeta && Array.isArray(routeMeta)) {
      const titleMeta = routeMeta.find(hasTitle);
      if (titleMeta?.title) {
        document.title = titleMeta.title;
      }
    }
  }, [routeMeta]);
}
