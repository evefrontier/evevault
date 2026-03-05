import { useNetworkStore } from "@evevault/shared";
import { processOAuthUser } from "@evevault/shared/auth";
import { getUserManager } from "@evevault/shared/auth/authConfig";
import { Heading, Text } from "@evevault/shared/components";
import type { RoutePath } from "@evevault/shared/types";
import { createLogger, ROUTE_PATHS } from "@evevault/shared/utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const log = createLogger();

const isRoutePath = (value: string): value is RoutePath => {
  return ROUTE_PATHS.includes(value as RoutePath);
};

/** Map shared RoutePath to web app route (router expects /wallet/* not /add-token etc.) */
const toWebRoute = (
  path: RoutePath,
):
  | "/"
  | "/wallet"
  | "/callback"
  | "/not-found"
  | "/wallet/add-token"
  | "/wallet/send-token"
  | "/wallet/transactions" => {
  if (path === "/add-token") return "/wallet/add-token";
  if (path === "/send-token") return "/wallet/send-token";
  if (path === "/transactions") return "/wallet/transactions";
  if (
    path === "/" ||
    path === "/wallet" ||
    path === "/callback" ||
    path === "/not-found" ||
    path === "/wallet/add-token" ||
    path === "/wallet/send-token" ||
    path === "/wallet/transactions"
  ) {
    return path;
  }
  return "/wallet";
};

export const CallbackScreen = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const _search = useSearch({ from: "/callback" });

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const userManager = getUserManager();

        // Popup flow: callback runs in popup; library passes result to opener
        if (typeof window !== "undefined" && window.opener) {
          await userManager.signinPopupCallback();
          window.close();
          return;
        }

        // Redirect flow: process callback and navigate
        const redirectAfterLogin = sessionStorage.getItem(
          "evevault_redirect_after_login",
        );
        sessionStorage.removeItem("evevault_redirect_after_login");
        const fallbackRoute: RoutePath = "/wallet";
        const redirectTo = redirectAfterLogin || fallbackRoute;

        const user = await userManager.signinRedirectCallback();
        const enokiApiKey = import.meta.env.VITE_ENOKI_API_KEY ?? "";
        const network = useNetworkStore.getState().chain;

        await processOAuthUser(user, enokiApiKey, network);

        log.info("FusionAuth callback successful");
        const destination = isRoutePath(redirectTo)
          ? toWebRoute(redirectTo)
          : "/wallet";
        navigate({ to: destination });
      } catch (err) {
        log.error("OAuth callback error", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => {
          navigate({ to: "/" });
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
        <section className="flex flex-col items-center gap-10 w-full flex-1">
          <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
          <header className="flex flex-col items-center gap-4 text-center">
            <Heading level={2}>Authentication Error</Heading>
            <Text color="error">{error}</Text>
            <Text>Redirecting to login...</Text>
          </header>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>Completing authentication...</Heading>
          <Text variant="light" size="large">
            Please wait while we finish signing you in.
          </Text>
        </header>
      </section>
    </div>
  );
};
