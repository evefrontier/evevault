import type { IntentScope } from '@mysten/sui/cryptography'
import { SUI_LOCALNET_CHAIN, type SuiChain } from '@mysten/wallet-standard'
import { browser } from '@wxt-dev/browser'
import { VaultMessageTypes } from '#/types'
import type { ZkSignAnyParams } from '#/types/wallet'
import { toErrorMessage } from '#/utils/errorMessage'
import { assertAliasEnforced } from './aliasEnforcement'
import { zkSignAny } from './zkSignAny'

/**
 * Unified signing entry point. Calls to sign in keeper only on localnet,
 * utilises zkSignAny (zkLogin) implementation on all other chains.
 */
export async function signForChain(
  scope: IntentScope,
  msgBytes: Uint8Array,
  opts: {
    chain: SuiChain
    user: ZkSignAnyParams['user'] | null
    getZkProof: ZkSignAnyParams['getZkProof'] | null
    localnetAddress?: string | null
  },
): Promise<{ bytes: string; signature: string }> {
  if (opts.chain === SUI_LOCALNET_CHAIN) {
    if (!opts.localnetAddress) {
      throw new Error(
        '[signForChain] No localnet address. Localnet private key might be missing.',
      )
    }

    if (!browser?.runtime?.sendMessage) {
      throw new Error(
        '[signForChain] Localnet signing is only available in the extension.',
      )
    }

    try {
      // Extension: Use background script
      const response = (await browser.runtime.sendMessage({
        type: VaultMessageTypes.LOCALNET_SIGN_BYTES,
        msgBytes: Array.from(msgBytes), // Convert Uint8Array to array for serialization
        scope,
      })) as
        | {
            ok?: boolean
            bytes?: string
            signature?: string
            error?: unknown
          }
        | undefined

      if (!response) {
        throw new Error(
          '[signForChain] No response from background script. The extension may not be properly initialized.',
        )
      }

      if (!response.ok || !response.bytes || !response.signature) {
        throw new Error(toErrorMessage(response.error, 'Failed to sign bytes'))
      }

      return { bytes: response.bytes, signature: response.signature }
    } catch (error) {
      throw new Error(
        toErrorMessage(
          error,
          '[signForChain] Unknown error during localnet signing',
        ),
      )
    }
  }

  if (!opts.user) {
    throw new Error('[signForChain] User not found for current network')
  }

  if (!opts.getZkProof) {
    throw new Error('[signForChain] getZkProof is required for zkLogin signing')
  }

  // Enforcement backstop: block signing until the account has a non-self alias.
  // Alias-setup transactions are exempt so the first alias can be registered.
  await assertAliasEnforced({
    chain: opts.chain,
    owner: (opts.user?.profile?.sui_address as string | undefined) ?? null,
    scope,
    msgBytes,
  })

  const { bytes, zkSignature } = await zkSignAny(scope, msgBytes, {
    user: opts.user,
    getZkProof: opts.getZkProof,
  })
  return { bytes, signature: zkSignature }
}
