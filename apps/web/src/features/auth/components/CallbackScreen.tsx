import { useNetworkStore } from "@evevault/shared";
import { processOAuthUser } from "@evevault/shared/auth";
import { getUserManager } from "@evevault/shared/auth/authConfig";
import { Heading, Text } from "@evevault/shared/components";
import type { RoutePath } from "@evevault/shared/types";
import {
  createLogger,
  ROUTE_PATHS,
  toWebRoute,
  WEB_ROUTES,
} from "@evevault/shared/utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const log = createLogger();

const isRoutePath = (value: string): value is RoutePath => {
  return ROUTE_PATHS.includes(value as RoutePath);
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
        const fallbackRoute = WEB_ROUTES.WALLET;
        const redirectTo = redirectAfterLogin ?? fallbackRoute;

        const user = await userManager.signinRedirectCallback();
        const enokiApiKey = import.meta.env.VITE_ENOKI_API_KEY ?? "";
        const network = useNetworkStore.getState().chain;

        await processOAuthUser(user, enokiApiKey, network);

        log.info("FusionAuth callback successful");
        const destination = isRoutePath(redirectTo)
          ? toWebRoute(redirectTo)
          : WEB_ROUTES.WALLET;
        navigate({ to: destination });
      } catch (err) {
        log.error("OAuth callback error", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => {
          navigate({ to: WEB_ROUTES.HOME });
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
