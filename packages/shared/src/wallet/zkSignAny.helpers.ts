import type { IntentScope } from '@mysten/sui/cryptography'
import { ephKeyService } from '#/services/vaultService'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import { VaultMessageTypes } from '#/types/messages'
import type { ZkSignAnyParams } from '#/types/wallet'
import { isWeb } from '#/utils/environment'
import { signWithIntent } from './signWithIntent'

type EphemeralSignature = {
  bytes: string
  userSignature: string
}

type ZkLoginClaims = {
  salt: string
  sub: string
  aud: string
}

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
): Promise<EphemeralSignature> => {
  const signature = isWeb()
    ? await signWithWebEphemeralKey(scope, msgBytes, user)
    : await signWithExtensionEphemeralKey(scope, msgBytes, user)

  if (!signature.userSignature) {
    throw new Error('User signature not found')
  }
  return signature
}

/** `salt`, `sub`, and `aud` must all be non-empty — any missing field breaks the on-chain zkLogin address derivation. */
export const requireZkLoginClaims = (
  user: NonNullable<ZkSignAnyParams['user']>,
): ZkLoginClaims => ({
  salt: requireProfileField(user.profile?.salt, 'salt'),
  sub: requireProfileField(user.profile?.sub, 'sub'),
  aud: requireProfileField(user.profile?.aud, 'aud'),
})

const signWithWebEphemeralKey = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  user: NonNullable<ZkSignAnyParams['user']>,
): Promise<EphemeralSignature> => {
  const signer = ephKeyService.getSigner()
  if (!signer) {
    throw new Error('Vault is locked or no keypair exists')
  }

  const result = await signWithIntent(msgBytes, scope, {
    sui_address: user.profile?.sui_address as string,
    keypair: signer,
  })
  return { bytes: result.bytes, userSignature: result.userSignature }
}

const signWithExtensionEphemeralKey = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  user: NonNullable<ZkSignAnyParams['user']>,
): Promise<EphemeralSignature> => {
  const response = (await chrome.runtime?.sendMessage?.({
    type: VaultMessageTypes.ZK_EPH_SIGN_BYTES,
    msgBytes: Array.from(msgBytes),
    scope,
    sui_address: user.profile?.sui_address as string,
  })) as
    | { ok?: boolean; bytes?: string; userSignature?: string; error?: string }
    | undefined

  if (!response) {
    throw new Error(
      'No response from background script. The extension may not be properly initialized.',
    )
  }

  if (!response.ok || !response.bytes || !response.userSignature) {
    throw new Error(response.error || 'Failed to sign bytes')
  }

  return { bytes: response.bytes, userSignature: response.userSignature }
}

const requireProfileField = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required zkLogin profile field: ${field}`)
  }
  return value
}
