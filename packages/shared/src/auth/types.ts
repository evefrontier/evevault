import type { SuiChain } from "@mysten/wallet-standard";
import type { User } from "oidc-client-ts";
import type { JwtResponse } from "../types/authTypes";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
}

export type GlobalWithLocalStorage = typeof globalThis & {
  localStorage?: StorageLike;
};

export type ImportMetaWithEnv = ImportMeta & {
  env: Record<string, string | undefined>;
};

export type GlobalWithProcessEnv = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export interface GetZkLoginAddressParams {
  jwt: string;
  enokiApiKey: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<User | undefined>;
  extensionLogin: () => Promise<JwtResponse>;
  refreshJwt: (chain: SuiChain) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
}
