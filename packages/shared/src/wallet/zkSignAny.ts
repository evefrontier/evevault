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
import { createLogger } from '#/utils/logger'
import { signWithIntent } from './signWithIntent'

const log = createLogger()

/**
 * Signs either a message or transaction with zkLogin depending on the intent scope.
 * Works with both extension (Ed25519 via background script) and web (Secp256r1 via WebCrypto).
 */
export const zkSignAny = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  params: ZkSignAnyParams,
): Promise<{ zkSignature: string; bytes: string }> => {
  const { user, getZkProof } = params

  if (user === null) {
    throw new Error('User not found')
  }

  const ephemeralPublicKey = useDeviceStore.getState().ephemeralPublicKey
  if (!ephemeralPublicKey) {
    throw new Error('Ephemeral key pair not found')
  }

  log.info('Getting ZK proof')
  const zkProof = await getZkProof()
  if (!zkProof || zkProof.error) {
    const errorMsg =
      typeof zkProof?.error === 'string'
        ? zkProof.error
        : (zkProof?.error?.message ?? 'Failed to get ZK proof')
    throw new Error(errorMsg)
  }

  const chain = useContextStore.getState().chain
  const maxEpoch = useDeviceStore.getState().getMaxEpoch(chain)
  if (maxEpoch == null || maxEpoch === '') {
    throw new Error('Max epoch is not set')
  }

  log.info('Requesting ephemeral signature')

  let bytes: string
  let userSignature: string

  if (isWeb()) {
    // Web: Use WebCryptoSigner directly
    const signer = ephKeyService.getSigner()
    if (!signer) {
      throw new Error('Vault is locked or no keypair exists')
    }

    const sui_address = user.profile?.sui_address as string
    const signResult = await signWithIntent(msgBytes, scope, {
      sui_address,
      keypair: signer, // Ephemeral keypair
    })

    bytes = signResult.bytes
    userSignature = signResult.userSignature
  } else {
    // Extension: Use background script
    const response = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.ZK_EPH_SIGN_BYTES,
      msgBytes: Array.from(msgBytes), // Convert Uint8Array to array for serialization
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
      const errorMessage = response.error || 'Failed to sign bytes'
      throw new Error(errorMessage)
    }

    bytes = response.bytes
    userSignature = response.userSignature
  }

  if (!userSignature) {
    throw new Error('User signature not found')
  }

  if (!('data' in zkProof) || !isPartialZKLoginSignature(zkProof.data)) {
    throw new Error('ZK proof data not found or invalid')
  }

  const salt = user.profile?.salt
  const sub = user.profile?.sub
  const aud = user.profile?.aud

  if (typeof salt !== 'string' || salt.trim() === '') {
    throw new Error('Missing required zkLogin profile field: salt')
  }

  if (typeof sub !== 'string' || sub.trim() === '') {
    throw new Error('Missing required zkLogin profile field: sub')
  }

  if (typeof aud !== 'string' || aud.trim() === '') {
    throw new Error('Missing required zkLogin profile field: aud')
  }

  log.info('Combining proof and signature to create zkLogin signature')

  const zkProofHandler = new ZKProofHandler()
  zkProofHandler.applyZKProof({
    maxEpoch: parseInt(maxEpoch, 10),
    partialZkLoginSignature: zkProof.data,
    userSalt: salt,
    tokenClaimSub: sub,
    tokenClaimAud: aud,
  })
  const { signature: zkSignature } = zkProofHandler.processSignature({
    signature: userSignature,
    bytes,
  })

  return { bytes, zkSignature }
}
