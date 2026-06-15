import { fromBase64 } from '@mysten/sui/utils'
import {
  ReadonlyWalletAccount,
  SUI_LOCALNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { WALLET_FEATURES } from './walletFeatures'

type AuthToken = {
  address: string
  publicKey: string
}

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

function getAccountMetadata(message: Record<string, unknown>): AuthToken {
  if (
    typeof message.address !== 'string' ||
    !message.address ||
    typeof message.publicKey !== 'string' ||
    !message.publicKey
  ) {
    throw new Error('Authentication response missing account metadata')
  }

  return {
    address: message.address,
    publicKey: message.publicKey,
  }
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
 * Builds the zkLogin Wallet Standard account from metadata resolved in the
 * extension background. OAuth tokens must never leave the extension boundary.
 */
async function buildZkLoginAccount(
  message: Record<string, unknown>,
  chains: SuiChain[],
) {
  const { address, publicKey: publicKeyB64 } = getAccountMetadata(message)
  const publicKey = decodePublicKey(publicKeyB64)

  return new ReadonlyWalletAccount({
    address,
    publicKey,
    chains,
    features: [...WALLET_FEATURES],
  })
}

/**
 * Decodes and validates the background-resolved public key before account
 * construction so malformed auth metadata fails during connect instead of later
 * during signing. The zkLogin address lookup itself happens in the extension
 * background; this only consumes the resulting metadata.
 */
function decodePublicKey(publicKeyB64: string): Uint8Array {
  const trimmedPublicKey = publicKeyB64.trim()
  if (!trimmedPublicKey) {
    throw new Error('No public key in auth metadata')
  }

  try {
    return fromBase64(trimmedPublicKey)
  } catch {
    throw new Error('Invalid base64 public key in auth metadata')
  }
}
