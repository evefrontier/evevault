import { useCallback, useEffect, useMemo } from 'react'
import { useToast } from '#/components'
import { useAddressAliases } from './useAliases.query'
import {
  addAliasTxBytes,
  enableAliasTxBytes,
  executeAliasTx,
} from './useAliases.transaction'
import { validateNewAlias } from './useAliases.validation'
import { useTransactionWrite } from './useTransactionWrite'
import { useWalletSigningContext } from './useWalletSigningContext'

interface UseAliasesResult {
  // State
  isAuthenticated: boolean
  isWalletUnlocked: boolean
  ownerAddress: string | null
  enabled: boolean
  aliases: string[]

  // Read status
  isReading: boolean
  readError: string | null

  // Actions
  enable: () => Promise<void>
  /** Resolves `true` when the alias was submitted successfully. */
  addAlias: (alias: string) => Promise<boolean>
  refresh: () => Promise<void>

  // Write status
  isSubmitting: boolean
  error: string | null
  txDigest: string | null
}

/**
 * Hook for reading and managing address aliases. Built on
 * `useWalletSigningContext` and composed from the `useAliases.*` helpers,
 * mirroring the structure of `useSendToken`.
 */
export function useAliases(): UseAliasesResult {
  const { showToast } = useToast()
  const { isSubmitting, error, txDigest, run, setError } = useTransactionWrite()

  const {
    chain,
    isAuthenticated,
    isWalletUnlocked,
    senderAddress,
    suiClient,
    getSenderAddress,
    sign,
  } = useWalletSigningContext()

  // Show toast when error occurs
  useEffect(() => {
    if (error) {
      showToast('Transaction failed')
    }
  }, [error, showToast])

  // Show toast when transaction succeeds
  useEffect(() => {
    if (txDigest) {
      showToast('Transaction confirmed!')
    }
  }, [txDigest, showToast])

  const {
    data,
    isLoading: isReading,
    error: readQueryError,
    refetch,
  } = useAddressAliases({ owner: senderAddress, suiClient, chain })

  const enabled = data?.enabled ?? false
  const aliases = useMemo(() => data?.aliases ?? [], [data?.aliases])
  const objectId = data?.objectId

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const enable = useCallback(async () => {
    if (!senderAddress) {
      setError('Connect wallet first')
      return
    }
    await run(
      () =>
        executeAliasTx({
          suiClient,
          getSenderAddress,
          sign,
          buildBytes: enableAliasTxBytes,
        }),
      {
        fallbackMessage: 'Failed to enable aliasing',
        onSuccess: async () => {
          await refetch()
        },
      },
    )
  }, [senderAddress, run, setError, suiClient, getSenderAddress, sign, refetch])

  const addAlias = useCallback(
    async (alias: string): Promise<boolean> => {
      if (!senderAddress) {
        setError('Connect wallet first')
        return false
      }
      if (!objectId) {
        setError('Enable aliasing first')
        return false
      }
      const validationError = validateNewAlias({ alias, existing: aliases })
      if (validationError) {
        setError(validationError)
        return false
      }
      const trimmed = alias.trim()
      const digest = await run(
        () =>
          executeAliasTx({
            suiClient,
            getSenderAddress,
            sign,
            buildBytes: (sender, client) =>
              addAliasTxBytes(sender, objectId, trimmed, client),
          }),
        {
          fallbackMessage: 'Failed to add alias',
          onSuccess: async () => {
            await refetch()
          },
        },
      )
      return digest !== null
    },
    [
      senderAddress,
      objectId,
      aliases,
      run,
      setError,
      suiClient,
      getSenderAddress,
      sign,
      refetch,
    ],
  )

  return {
    isAuthenticated,
    isWalletUnlocked,
    ownerAddress: senderAddress,
    enabled,
    aliases,
    isReading,
    readError:
      readQueryError instanceof Error
        ? readQueryError.message
        : readQueryError
          ? 'Failed to read aliases'
          : null,

    enable,
    addAlias,
    refresh,

    isSubmitting,
    error,
    txDigest,
  }
}
