import type { ZKProofData } from '@evefrontier/wallet-core/crypto'
import type { IntentScope } from '@mysten/sui/cryptography'
import { browser } from '@wxt-dev/browser'
import { ephKeyService } from '#/services/vaultService'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import { VaultMessageTypes } from '#/types/messages'
import type { ZkSignAnyParams } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { toErrorMessage } from '#/utils/errorMessage'

type EphemeralSignature = {
  bytes: string
  userSignature: string
}

type ZkLoginClaims = {
  salt: string
  keyClaimName: string
  keyClaimValue: string
  aud: string
}

const ZK_LOGIN_KEY_CLAIM_NAME = 'sub'

export const requireZkLoginUser = (user: ZkSignAnyParams['user']) => {
  if (user == null) {
    throw new Error('User not found')
  }
  return user
}

export const requireEphemeralPublicKey = () => {
  const ephemeralPublicKey = useDeviceStore.getState().ephemeralPublicKey
  if (!ephemeralPublicKey) {
    throw new Error('Ephemeral key pair not found')
  }
  return ephemeralPublicKey
}

export const requireMaxEpoch = (): string => {
  const chain = useContextStore.getState().chain
  const maxEpoch = useDeviceStore.getState().getMaxEpoch(chain)
  if (maxEpoch == null || maxEpoch === '') {
    throw new Error('Max epoch is not set')
  }
  return maxEpoch
}

/** Web uses an in-process WebCrypto signer; extension must message the background script because the private key never leaves the service worker. */
export const signWithEphemeralKey = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  user: NonNullable<ZkSignAnyParams['user']>,
  zkProofData: ZKProofData,
): Promise<EphemeralSignature> => {
  const signature = isWeb()
    ? await signWithWebEphemeralKey(scope, msgBytes, user, zkProofData)
    : await signWithExtensionEphemeralKey(scope, msgBytes, user, zkProofData)

  if (!signature.userSignature) {
    throw new Error('User signature not found')
  }
  return signature
}

/** `salt`, the configured key claim, and `aud` must all be non-empty — any missing field breaks the on-chain zkLogin address derivation. */
export const requireZkLoginClaims = (
  user: NonNullable<ZkSignAnyParams['user']>,
): ZkLoginClaims => ({
  salt: requireProfileField(user.profile?.salt, 'salt'),
  keyClaimName: ZK_LOGIN_KEY_CLAIM_NAME,
  keyClaimValue: requireProfileField(
    user.profile?.sub,
    ZK_LOGIN_KEY_CLAIM_NAME,
  ),
  aud: requireProfileField(user.profile?.aud, 'aud'),
})

const signWithWebEphemeralKey = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  user: NonNullable<ZkSignAnyParams['user']>,
  zkProofData: ZKProofData,
): Promise<EphemeralSignature> => {
  const signer = ephKeyService.getSigner()
  if (!signer) {
    throw new Error('Vault is locked or no keypair exists')
  }

  if (!user.profile?.sui_address) {
    throw new Error('[signWithWebEphemeralKey] User address not found')
  }

  signer.applyZKProof(zkProofData)
  // Scope routing is inline rather than via wallet-core's signWithIntent: the
  // proof is already applied above, so signing directly emits the zkLogin
  // signature. See the matching note in the keeper's handleEphSign.
  const result =
    scope === 'TransactionData'
      ? await signer.signTransaction(msgBytes)
      : await signer.signPersonalMessage(msgBytes)
  return { bytes: result.bytes, userSignature: result.signature }
}

const signWithExtensionEphemeralKey = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  user: NonNullable<ZkSignAnyParams['user']>,
  zkProofData: ZKProofData,
): Promise<EphemeralSignature> => {
  if (!user.profile?.sui_address) {
    throw new Error('[signWithExtensionEphemeralKey] User address not found')
  }

  const response = (await browser.runtime?.sendMessage?.({
    type: VaultMessageTypes.ZK_EPH_SIGN_BYTES,
    msgBytes: Array.from(msgBytes),
    scope,
    zkProofData,
  })) as
    | { ok?: boolean; bytes?: string; userSignature?: string; error?: unknown }
    | undefined

  if (!response) {
    throw new Error(
      'No response from background script. The extension may not be properly initialized.',
    )
  }

  if (!response.ok || !response.bytes || !response.userSignature) {
    throw new Error(toErrorMessage(response.error, 'Failed to sign bytes'))
  }

  return { bytes: response.bytes, userSignature: response.userSignature }
}

const requireProfileField = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required zkLogin profile field: ${field}`)
  }
  return value
}
