import { useAuthStore, waitForAuthHydration } from "@evevault/shared/auth";
import type { RoutePath } from "@evevault/shared/types";
import { ROUTE_PATHS } from "@evevault/shared/utils";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/features/auth/components/LoginScreen";

const resolveRoute = (target?: string): RoutePath => {
  if (target && ROUTE_PATHS.includes(target as RoutePath)) {
    return target as RoutePath;
  }
  return "/wallet";
};

type IndexSearch = {
  redirect?: string;
};

const getOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const validateSearch = (search: Record<string, unknown>): IndexSearch => ({
  redirect: getOptionalString(search.redirect),
});

export const Route = createFileRoute("/")({
  validateSearch,
  beforeLoad: async ({ search }) => {
    document.title = "EVE Vault - Sign In";
    await waitForAuthHydration(); // TODO(dev-auth): remove when real login is available

    // If user is already authenticated, redirect to wallet or intended destination
    const user = useAuthStore.getState().user;
    if (user) {
      const redirectTo = resolveRoute(search.redirect);
      throw redirect({
        to: redirectTo,
      });
    }
  },
  component: LoginScreen,
});
