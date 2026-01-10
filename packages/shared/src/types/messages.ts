import type { JwtResponse } from "./authTypes";
import type { ZkProofResponse } from "./enoki";
import type { StoredSecretKey } from "./stores";

export enum AuthMessageTypes {
  AUTH_SUCCESS = "auth_success",
  AUTH_ERROR = "auth_error",
  EXT_LOGIN = "ext_login",
  REFRESH_TOKEN = "refresh_token",
}

export type AuthMessage = {
  type: AuthMessageTypes | string;
  /** JWT response from OAuth/OIDC provider */
  token?: JwtResponse;
  error?: unknown;
  id?: string;
};

export enum VaultMessageTypes {
  UNLOCK_VAULT = "UNLOCK_VAULT",
  LOCK = "LOCK",
  CREATE_KEYPAIR = "CREATE_KEYPAIR",
  GET_PUBLIC_KEY = "GET_PUBLIC_KEY",
  ZK_EPH_SIGN_BYTES = "ZK_EPH_SIGN_BYTES",
  SET_ZKPROOF = "SET_ZKPROOF",
  GET_ZKPROOF = "GET_ZKPROOF",
  CLEAR_ZKPROOF = "CLEAR_ZKPROOF",
}

export enum WalletStandardMessageTypes {
  SIGN_PERSONAL_MESSAGE = "sign_personal_message",
  SIGN_TRANSACTION = "sign_transaction",
  SIGN_AND_EXECUTE_TRANSACTION = "sign_and_execute_transaction",
}

export enum KeeperMessageTypes {
  READY = "KEEPER_READY",
  CREATE_KEYPAIR = "KEEPER_CREATE_KEYPAIR",
  UNLOCK_VAULT = "KEEPER_UNLOCK_VAULT",
  GET_PUBLIC_KEY = "KEEPER_GET_KEY",
  EPH_SIGN = "KEEPER_EPH_SIGN",
  CLEAR_EPHKEY = "KEEPER_CLEAR_EPHKEY",
  SET_ZKPROOF = "KEEPER_SET_ZKPROOF",
  GET_ZKPROOF = "KEEPER_GET_ZKPROOF",
  CLEAR_ZKPROOF = "KEEPER_CLEAR_ZKPROOF",
}

// Response type for vault/keeper message handlers
export interface VaultResponse {
  ok?: boolean;
  error?: string;
  hashedSecretKey?: StoredSecretKey;
  publicKeyBytes?: number[];
  zkProof?: ZkProofResponse;
}
