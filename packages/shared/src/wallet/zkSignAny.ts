import {
  createZkLoginSignature,
  loadZkProof,
} from '@evefrontier/wallet-core/crypto'
import type { IntentScope } from '@mysten/sui/cryptography'
import type { ZkSignAnyParams } from '#/types/wallet'
import { createLogger } from '#/utils/logger'
import {
  requireEphemeralPublicKey,
  requireMaxEpoch,
  requireZkLoginClaims,
  requireZkLoginUser,
  signWithEphemeralKey,
} from './zkSignAny.helpers'

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
  const user = requireZkLoginUser(params.user)
  requireEphemeralPublicKey()

  log.info('Getting ZK proof')
  const zkProof = await loadZkProof(params.getZkProof)
  const maxEpoch = requireMaxEpoch()

  log.info('Requesting ephemeral signature')
  const { bytes, userSignature } = await signWithEphemeralKey(
    scope,
    msgBytes,
    user,
  )

  log.info('Combining proof and signature to create zkLogin signature')
  const zkSignature = createZkLoginSignature({
    maxEpoch,
    partialZkLoginSignature: zkProof,
    claims: requireZkLoginClaims(user),
    userSignature,
    bytes,
  })

  return { bytes, zkSignature }
}
