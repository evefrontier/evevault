import { loadZkProof, type ZKProofData } from '@evefrontier/wallet-core/crypto'
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
  const partialZkLoginSignature = await loadZkProof(params.getZkProof)
  const maxEpoch = requireMaxEpoch()
  const claims = requireZkLoginClaims(user)

  const zkProofData: ZKProofData = {
    maxEpoch: Number(maxEpoch),
    partialZkLoginSignature,
    userSalt: claims.salt,
    keyClaimName: claims.keyClaimName,
    keyClaimValue: claims.keyClaimValue,
    aud: claims.aud,
  }

  log.info('Requesting ephemeral signature')
  const { bytes, userSignature: zkSignature } = await signWithEphemeralKey(
    scope,
    msgBytes,
    user,
    zkProofData,
  )

  return { bytes, zkSignature }
}
