import type { SuiChain } from '@mysten/wallet-standard'
import type { AuthSuccessToken } from './authTypes'
import type { StoredSecretKey } from './stores'
import type { ZkProofResponse } from './zkLogin'

export enum AuthMessageTypes {
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  EXT_LOGIN = 'ext_login',
  REFRESH_TOKEN = 'refresh_token',
}

export type ExtensionAuthSuccessMessage = {
  type: AuthMessageTypes.AUTH_SUCCESS
  id?: string
  /** Token material for extension-internal auth only; never page-facing. */
  token: AuthSuccessToken
}

export type DappConnectSuccessMessage = {
  type: AuthMessageTypes.AUTH_SUCCESS
  id: string
  chain: SuiChain
  address: string
  publicKey?: string
}

export type AuthErrorMessage = {
  type: AuthMessageTypes.AUTH_ERROR
  error?: unknown
  id?: string
}

export type AuthMessage =
  | ExtensionAuthSuccessMessage
  | AuthErrorMessage
  | {
      type: AuthMessageTypes | string
      id?: string
      token?: AuthSuccessToken
      error?: unknown
    }

export enum VaultMessageTypes {
  UNLOCK_VAULT = 'UNLOCK_VAULT',
  LOCK = 'LOCK',
  CREATE_KEYPAIR = 'CREATE_KEYPAIR',
  ROTATE_KEYPAIR = 'ROTATE_KEYPAIR',
  GET_PUBLIC_KEY = 'GET_PUBLIC_KEY',
  GET_UNLOCK_REMAINING = 'GET_UNLOCK_REMAINING',
  ZK_EPH_SIGN_BYTES = 'ZK_EPH_SIGN_BYTES',
  SET_ZKPROOF = 'SET_ZKPROOF',
  GET_ZKPROOF = 'GET_ZKPROOF',
  CLEAR_ZKPROOF = 'CLEAR_ZKPROOF',
  // Localnet dev-only: persistent keypair management and direct signing
  LOCALNET_SET_KEYPAIR = 'LOCALNET_SET_KEYPAIR',
  LOCALNET_GET_ADDRESS = 'LOCALNET_GET_ADDRESS',
  LOCALNET_SIGN_BYTES = 'LOCALNET_SIGN_BYTES',
}

export enum WalletStandardMessageTypes {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  SIGN_PERSONAL_MESSAGE = 'sign_personal_message',
  SIGN_TRANSACTION = 'sign_transaction',
  SIGN_AND_EXECUTE_TRANSACTION = 'sign_and_execute_transaction',
  EVEFRONTIER_SIGN_SPONSORED_TRANSACTION = 'sign_sponsored_transaction',
}

export enum KeeperMessageTypes {
  READY = 'KEEPER_READY',
  CREATE_KEYPAIR = 'KEEPER_CREATE_KEYPAIR',
  ROTATE_KEYPAIR = 'KEEPER_ROTATE_KEYPAIR',
  UNLOCK_VAULT = 'KEEPER_UNLOCK_VAULT',
  GET_PUBLIC_KEY = 'KEEPER_GET_KEY',
  GET_UNLOCK_REMAINING = 'KEEPER_GET_UNLOCK_REMAINING',
  EPH_SIGN = 'KEEPER_EPH_SIGN',
  CLEAR_EPHKEY = 'KEEPER_CLEAR_EPHKEY',
  SET_ZKPROOF = 'KEEPER_SET_ZKPROOF',
  GET_ZKPROOF = 'KEEPER_GET_ZKPROOF',
  CLEAR_ZKPROOF = 'KEEPER_CLEAR_ZKPROOF',
  // Localnet dev-only
  LOCALNET_SET_KEYPAIR = 'KEEPER_LOCALNET_SET_KEYPAIR',
  LOCALNET_GET_ADDRESS = 'KEEPER_LOCALNET_GET_ADDRESS',
  LOCALNET_SIGN = 'KEEPER_LOCALNET_SIGN',
}

/**
 * Returned by the keeper when a sign request arrives after the unlock window
 * expired. Recoverable: re-unlocking and re-approving the same request succeeds,
 * so the popup should catch this rather than surface it to the dApp.
 */
export const KEEPER_EPH_SIGN_LOCKED_ERROR = `[${KeeperMessageTypes.EPH_SIGN}] LOCKED`

/** True when an error message is the keeper's recoverable locked-vault signal. */
export const isKeeperLockedError = (message: unknown): boolean =>
  typeof message === 'string' && message.includes(KEEPER_EPH_SIGN_LOCKED_ERROR)

// Response type for vault/keeper message handlers
export interface VaultResponse {
  ok?: boolean
  error?: string
  hashedSecretKey?: StoredSecretKey
  publicKeyBytes?: number[]
  zkProof?: ZkProofResponse
  remainingMs?: number
}
