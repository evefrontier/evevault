// TODO(dev-auth): Remove this helper once local FusionAuth callbacks work.

import {
  getEnokiApiKey,
  getUserManager,
  getZkLoginAddress,
} from "@evevault/shared/auth";
import { createLogger } from "@evevault/shared/utils";
import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";

const log = createLogger();

type EvevaultToken = {
  access_token: string;
  id_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  expires_at?: number;
} & Record<string, unknown>;

type RawTokenInput =
  | string
  | EvevaultToken
  | {
      "evevault:jwt"?: EvevaultToken;
      [key: string]: unknown;
    };

interface DevWindow extends Window {
  seedEvevaultAuth?: (input: RawTokenInput) => Promise<void>;
}

const resolveToken = (input: RawTokenInput): EvevaultToken => {
  const normalized =
    typeof input === "string" ? JSON.parse(input) : (input as RawTokenInput);
  const tokenCandidate =
    typeof normalized === "object" && normalized !== null
      ? ((normalized as { "evevault:jwt"?: EvevaultToken })["evevault:jwt"] ??
        normalized)
      : undefined;

  if (
    !tokenCandidate ||
    typeof tokenCandidate !== "object" ||
    !("access_token" in tokenCandidate) ||
    !("id_token" in tokenCandidate)
  ) {
    throw new Error(
      "Input does not contain an evevault:jwt with id/access tokens",
    );
  }

  window.localStorage.setItem(
    "evevault:jwt",
    JSON.stringify({ [SUI_DEVNET_CHAIN]: tokenCandidate }),
  );

  return tokenCandidate as EvevaultToken;
};

const getExpiresAt = (token: EvevaultToken) => {
  if (typeof token.expires_at === "number") {
    return token.expires_at;
  }
  if (typeof token.expires_in === "number") {
    return Math.floor(Date.now() / 1000) + token.expires_in;
  }
  return Math.floor(Date.now() / 1000) + 3600;
};

const buildPersistedUser = async (token: EvevaultToken) => {
  const { data, error } = await getZkLoginAddress({
    jwt: token.id_token,
    enokiApiKey: getEnokiApiKey(),
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to fetch zkLogin address/salt for token",
    );
  }

  const claims = decodeJwt(token.id_token) as IdTokenClaims;

  return {
    id_token: token.id_token,
    access_token: token.access_token,
    token_type: token.token_type,
    scope: token.scope,
    expires_at: getExpiresAt(token),
    profile: {
      ...claims,
      sui_address: data.address,
      salt: data.salt,
    },
  };
};

type PersistedUser = Awaited<ReturnType<typeof buildPersistedUser>>;

const persistAuthState = (user: PersistedUser) => {
  const payload = {
    state: {
      user,
      loading: false,
      error: null,
    },
    version: 0,
  };
  localStorage.setItem("evevault:auth", JSON.stringify(payload));
};

const storeUserInOidcManager = async (user: PersistedUser) => {
  const userManager = getUserManager();
  const oidcUser = new User(user);
  await userManager.storeUser(oidcUser);
};

declare global {
  interface Window {
    seedEvevaultAuth?: (input: RawTokenInput) => Promise<void>;
  }
}

if (import.meta.env.DEV) {
  const devWindow = window as DevWindow;

  devWindow.seedEvevaultAuth = async (rawInput: RawTokenInput) => {
    try {
      const token = resolveToken(rawInput);
      const user = await buildPersistedUser(token);
      persistAuthState(user);
      await storeUserInOidcManager(user);
      log.info(
        "[dev-auth] Seeded evevault:auth from pasted evevault:jwt. Refresh to apply.",
      );
    } catch (error) {
      log.error("[dev-auth] Failed to seed auth state", error);
      throw error;
    }
  };

  log.info(
    "[dev-auth] window.seedEvevaultAuth(tokenDump) is available for seeding local auth.",
  );
}
