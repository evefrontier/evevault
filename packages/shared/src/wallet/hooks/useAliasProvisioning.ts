import {
  type GeneratedAliasKey,
  generateAliasKey,
  registerAcknowledgedAlias,
} from '@evefrontier/wallet-core/address-alias'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { invalidateAliasEnforcement } from '../aliasEnforcement'
import { useTransactionWrite } from './useTransactionWrite'
import { useWalletSigningContext } from './useWalletSigningContext'

export interface UseAliasProvisioningResult {
  /** The one-time personal access key to display, or `null` before generation / after registration. */
  aliasKey: GeneratedAliasKey | null
  ownerAddress: string | null
  /** Generates a fresh client-only personal access key and holds it in memory only. */
  generate: () => GeneratedAliasKey
  /** Drops the in-memory personal access key. */
  clear: () => void
  /**
   * Registers the generated key's address on-chain as an alias. `acknowledged`
   * must be true (user confirmed they saved the key), else it surfaces the
   * acknowledgement error. Resolves `true` on success.
   */
  register: (acknowledged: boolean) => Promise<boolean>
  isSubmitting: boolean
  error: string | null
  txDigest: string | null
}

/**
 * Drives one-time recovery-alias provisioning: generate a client-only key
 * (shown once, never persisted), then register it on-chain once the user
 * acknowledges saving it. Reuses the app signing context and the shared write
 * lifecycle, and invalidates alias caches/queries on success so the
 * enforcement gate clears.
 */
export function useAliasProvisioning(): UseAliasProvisioningResult {
  const queryClient = useQueryClient()
  const { chain, senderAddress, suiClient, sign } = useWalletSigningContext()
  const { isSubmitting, error, txDigest, run, setError } = useTransactionWrite()
  const [aliasKey, setAliasKey] = useState<GeneratedAliasKey | null>(null)

  // Adapts the signing-context callback to wallet-core's signer shape (same as
  // useAddressAliases). Alias-setup txs bypass the enforcement backstop.
  const signer = useMemo(
    () => ({
      signTransaction: (bytes: Uint8Array) => sign('TransactionData', bytes),
    }),
    [sign],
  )

  const generate = useCallback(() => {
    const key = generateAliasKey()
    setAliasKey(key)
    return key
  }, [])

  const clear = useCallback(() => setAliasKey(null), [])

  const register = useCallback(
    async (acknowledged: boolean): Promise<boolean> => {
      if (!senderAddress) {
        setError('Connect wallet first')
        return false
      }
      if (!aliasKey) {
        setError('Generate a personal access key first')
        return false
      }
      if (!acknowledged) {
        setError('Confirm you have saved your personal access key first')
        return false
      }
      const digest = await run(
        async () => {
          const { addDigest } = await registerAcknowledgedAlias({
            suiClient,
            owner: senderAddress,
            signer,
            aliasAddress: aliasKey.address,
            acknowledged,
          })
          // Wait for finality before invalidating, else the refetch can race
          // the write.
          await suiClient.core.waitForTransaction({ digest: addDigest })
          return addDigest
        },
        {
          fallbackMessage: 'Failed to register personal access alias',
          onSuccess: async () => {
            invalidateAliasEnforcement(senderAddress, chain)
            await queryClient.invalidateQueries({
              queryKey: ['address-aliases', senderAddress, chain],
            })
            setAliasKey(null)
          },
        },
      )
      return digest !== null
    },
    [
      senderAddress,
      aliasKey,
      run,
      setError,
      suiClient,
      signer,
      chain,
      queryClient,
    ],
  )

  return {
    aliasKey,
    ownerAddress: senderAddress,
    generate,
    clear,
    register,
    isSubmitting,
    error,
    txDigest,
  }
}
