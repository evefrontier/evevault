import { getZkLoginAddress } from '@evevault/shared/auth'
import { fromBase64 } from '@mysten/sui/utils'
import {
  ReadonlyWalletAccount,
  SUI_LOCALNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { WALLET_FEATURES } from './walletFeatures'

type AuthToken = {
  access_token: string
}

const AUTH_SESSION_JWT_KEY = 'evevault_jwt'

/**
 * Converts the auth success payload into the Wallet Standard account shape,
 * choosing the localnet path without zkLogin because localnet keys are stored
 * separately from the FusionAuth/Enoki session.
 */
export async function getAccountsFromAuthSuccess(
  message: Record<string, unknown>,
  chains: SuiChain[],
) {
  const account =
    message.chain === SUI_LOCALNET_CHAIN
      ? buildLocalnetAccount(message)
      : await buildZkLoginAccount(message, chains)

  return [account]
}

/**
 * Validates the token before writing sessionStorage so failed auth responses do
 * not leave a stale JWT from an earlier connection attempt.
 */
function getAuthToken(message: Record<string, unknown>): AuthToken {
  const token = message.token as AuthToken | undefined
  if (!token?.access_token) {
    throw new Error('Authentication response missing access token')
  }
  return token
}

/**
 * Builds a localnet account with an empty public key because localnet signing
 * happens through the extension keeper, not through zkLogin account metadata.
 */
function buildLocalnetAccount(message: Record<string, unknown>) {
  if (!message.address) {
    throw new Error('Localnet auth_success missing address')
  }

  return new ReadonlyWalletAccount({
    address: message.address as string,
    publicKey: new Uint8Array(0),
    chains: [SUI_LOCALNET_CHAIN],
    features: [...WALLET_FEATURES],
  })
}

/**
 * Looks up zkLogin account metadata from the freshly returned JWT so dApps get
 * the address/public key pair that matches the current OAuth session.
 */
async function buildZkLoginAccount(
  message: Record<string, unknown>,
  chains: SuiChain[],
) {
  const token = getAuthToken(message)
  sessionStorage.setItem(
    AUTH_SESSION_JWT_KEY,
    JSON.stringify(token.access_token),
  )

  const zkLoginResponse = await getZkLoginAddress({
    jwt: token.access_token,
    enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY,
  })

  if (zkLoginResponse.error) {
    throw new Error(zkLoginResponse.error.message)
  }
  if (!zkLoginResponse.data) {
    throw new Error('No data returned from zkLogin address lookup')
  }

  const { address, publicKey: publicKeyB64 } = zkLoginResponse.data
  const publicKey = decodePublicKey(publicKeyB64)

  return new ReadonlyWalletAccount({
    address,
    publicKey,
    chains,
    features: [...WALLET_FEATURES],
  })
}

/**
 * Decodes and validates the Enoki public key before account construction so
 * malformed lookup results fail during connect instead of later during signing.
 */
function decodePublicKey(publicKeyB64: string): Uint8Array {
  const trimmedPublicKey = publicKeyB64.trim()
  if (!trimmedPublicKey) {
    throw new Error('No public key returned from zkLogin address lookup')
  }

  try {
    return fromBase64(trimmedPublicKey)
  } catch {
    throw new Error(
      'Invalid base64 public key returned from zkLogin address lookup',
    )
  }
}
