import {
  isPartialZKLoginSignature,
  ZKProofHandler,
} from '@evefrontier/wallet-core/crypto'
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

export const loadZkProof = async (
  getZkProof: ZkSignAnyParams['getZkProof'],
) => {
  const zkProof = await getZkProof()
  const error = getProofErrorMessage(zkProof)
  if (error) {
    throw new Error(error)
  }
  if (!('data' in zkProof) || !isPartialZKLoginSignature(zkProof.data)) {
    throw new Error('ZK proof data not found or invalid')
  }
  return zkProof
}

export const requireMaxEpoch = (): string => {
  const chain = useContextStore.getState().chain
  const maxEpoch = useDeviceStore.getState().getMaxEpoch(chain)
  if (maxEpoch == null || maxEpoch === '') {
    throw new Error('Max epoch is not set')
  }
  return maxEpoch
}

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

export const requireZkLoginClaims = (
  user: NonNullable<ZkSignAnyParams['user']>,
): ZkLoginClaims => ({
  salt: requireProfileField(user.profile?.salt, 'salt'),
  sub: requireProfileField(user.profile?.sub, 'sub'),
  aud: requireProfileField(user.profile?.aud, 'aud'),
})

export const createZkLoginSignature = ({
  maxEpoch,
  partialZkLoginSignature,
  claims,
  userSignature,
  bytes,
}: {
  maxEpoch: string
  partialZkLoginSignature: unknown
  claims: ZkLoginClaims
  userSignature: string
  bytes: string
}): string => {
  if (!isPartialZKLoginSignature(partialZkLoginSignature)) {
    throw new Error('ZK proof data not found or invalid')
  }

  const zkProofHandler = new ZKProofHandler()
  zkProofHandler.applyZKProof({
    maxEpoch: parseInt(maxEpoch, 10),
    partialZkLoginSignature,
    userSalt: claims.salt,
    tokenClaimSub: claims.sub,
    tokenClaimAud: claims.aud,
  })
  return zkProofHandler.processSignature({ signature: userSignature, bytes })
    .signature
}

const getProofErrorMessage = (
  zkProof: Awaited<ReturnType<ZkSignAnyParams['getZkProof']>>,
): string | null => {
  if (!zkProof) {
    return 'Failed to get ZK proof'
  }
  if (!zkProof.error) {
    return null
  }
  return typeof zkProof.error === 'string'
    ? zkProof.error
    : (zkProof.error.message ?? 'Failed to get ZK proof')
}

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
