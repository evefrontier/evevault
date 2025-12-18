import { useAuthStore, waitForAuthHydration } from "@evevault/shared/auth";
import type { RoutePath } from "@evevault/shared/types";
import { ROUTE_PATHS } from "@evevault/shared/utils";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { LoginScreen } from "../features/auth/components/LoginScreen";

const resolveRoute = (target?: string): RoutePath => {
  if (target && ROUTE_PATHS.includes(target as RoutePath)) {
    return target as RoutePath;
  }
  return "/wallet";
};

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
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
  meta: () => [
    {
      title: "EVE Vault - Sign In",
    },
  ],
});
