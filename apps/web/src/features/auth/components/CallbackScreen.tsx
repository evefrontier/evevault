import { useNetworkStore } from "@evevault/shared";
import {
  getZkLoginAddress,
  storeJwt,
  useAuthStore,
} from "@evevault/shared/auth";
import { getUserManager } from "@evevault/shared/auth/authConfig";
import { Heading, Text } from "@evevault/shared/components";
import type { RoutePath } from "@evevault/shared/types";
import {
  createLogger,
  ROUTE_PATHS,
  SESSION_STORAGE_REDIRECT_KEY,
} from "@evevault/shared/utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { User } from "oidc-client-ts";
import { useEffect, useState } from "react";

const log = createLogger();
const DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;
const DEFAULT_AUTH_SCOPE = "openid email profile offline_access";

const isRoutePath = (value: string): value is RoutePath => {
  return ROUTE_PATHS.includes(value as RoutePath);
};

/** Guard so the OAuth code is only exchanged once (avoids "Invalid Authorization Code" from double-run in Strict Mode or reload). */
let callbackExchangeStarted = false;

export const CallbackScreen = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const _search = useSearch({ from: "/callback" });

  useEffect(() => {
    if (callbackExchangeStarted) {
      return;
    }
    callbackExchangeStarted = true;

    const handleCallback = async () => {
      try {
        const redirectAfterLogin = sessionStorage.getItem(
          SESSION_STORAGE_REDIRECT_KEY,
        );
        sessionStorage.removeItem(SESSION_STORAGE_REDIRECT_KEY);
        const fallbackRoute: RoutePath = "/wallet";
        const redirectTo = redirectAfterLogin || fallbackRoute;

        // Use oidc-client-ts's built-in PKCE support
        const userManager = getUserManager();
        const user = await userManager.signinRedirectCallback();

        if (!user || !user.id_token) {
          throw new Error("Failed to authenticate");
        }

        // Get zkLogin address
        const zkLoginResponse = await getZkLoginAddress({
          jwt: user.id_token,
          enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY,
        });

        if (zkLoginResponse.error) {
          throw new Error(zkLoginResponse.error.message);
        }

        if (!zkLoginResponse.data) {
          throw new Error("No zkLogin address data received");
        }

        const { salt, address } = zkLoginResponse.data;

        // Update user profile with zkLogin address
        const updatedUser = new User({
          ...user,
          profile: {
            ...user.profile,
            sui_address: address,
            salt,
          },
        });

        await userManager.storeUser(updatedUser);
        useAuthStore.getState().setUser(updatedUser);

        const network = useNetworkStore.getState().chain;
        await storeJwt(
          {
            id_token: user.id_token,
            access_token: user.access_token,
            token_type: user.token_type ?? "Bearer",
            expires_in: user.expires_in ?? DEFAULT_TOKEN_EXPIRY_SECONDS,
            scope: user.scope ?? DEFAULT_AUTH_SCOPE,
            refresh_token: user.refresh_token,
          },
          network,
        );

        log.info("FusionAuth callback successful");
        const destination = isRoutePath(redirectTo)
          ? redirectTo
          : fallbackRoute;
        navigate({ to: destination });
      } catch (err) {
        log.error("OAuth callback error", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => {
          navigate({ to: "/" });
        }, 3000);
      } finally {
        callbackExchangeStarted = false;
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
