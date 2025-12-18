import { getZkLoginAddress, useAuthStore } from "@evevault/shared/auth";
import { getUserManager } from "@evevault/shared/auth/authConfig";
import { Background, Heading, Text } from "@evevault/shared/components";
import type { RoutePath } from "@evevault/shared/types";
import { createLogger, ROUTE_PATHS } from "@evevault/shared/utils";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { User } from "oidc-client-ts";
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
        const redirectAfterLogin = sessionStorage.getItem(
          "evevault_redirect_after_login",
        );
        sessionStorage.removeItem("evevault_redirect_after_login");
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
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <Background>
        <div className="app-shell">
          <main className="app-shell__content">
            <div className="card">
              <Heading level={1} variant="bold">
                Authentication Error
              </Heading>
              <Text color="error">{error}</Text>
              <Text>Redirecting to login...</Text>
            </div>
          </main>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="app-shell">
        <main className="app-shell__content">
          <div className="card">
            <Heading level={1} variant="bold">
              Completing authentication...
            </Heading>
            <Text>Please wait while we finish signing you in.</Text>
          </div>
        </main>
      </div>
    </Background>
  );
};
