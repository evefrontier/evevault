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

export const AUTH_SESSION_JWT_KEY = 'evevault_jwt'

function getAuthToken(message: Record<string, unknown>): AuthToken {
  const token = message.token as AuthToken | undefined
  if (!token?.access_token) {
    throw new Error('Authentication response missing access token')
  }
  return token
}

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
