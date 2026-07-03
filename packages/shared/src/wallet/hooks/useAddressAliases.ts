import { useCallback, useEffect, useMemo } from 'react'
import { useToast } from '#/components'
import { useAddressAliasesQuery } from './useAddressAliases.query'
import {
  addAddressAliasTxBytes,
  enableAddressAliasTxBytes,
  executeAddressAliasTx,
} from './useAddressAliases.transaction'
import { validateNewAddressAlias } from './useAddressAliases.validation'
import { useTransactionWrite } from './useTransactionWrite'
import { useWalletSigningContext } from './useWalletSigningContext'

interface UseAddressAliasesResult {
  // State
  isAuthenticated: boolean
  isWalletUnlocked: boolean
  ownerAddress: string | null
  enabled: boolean
  addressAliases: string[]

  // Read status
  isReading: boolean
  readError: string | null

  // Actions
  enable: () => Promise<void>
  /** Resolves `true` when the address alias was submitted successfully. */
  addAddressAlias: (addressAlias: string) => Promise<boolean>
  refresh: () => Promise<void>

  // Write status
  isSubmitting: boolean
  error: string | null
  txDigest: string | null
}

/**
 * Hook for reading and managing address aliases.
 */
export function useAddressAliases(): UseAddressAliasesResult {
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
  } = useAddressAliasesQuery({ owner: senderAddress, suiClient, chain })

  const enabled = data?.enabled ?? false
  const addressAliases = useMemo(
    () => data?.addressAliases ?? [],
    [data?.addressAliases],
  )
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
        executeAddressAliasTx({
          suiClient,
          getSenderAddress,
          sign,
          buildBytes: enableAddressAliasTxBytes,
        }),
      {
        fallbackMessage: 'Failed to enable address aliasing',
        onSuccess: async () => {
          await refetch()
        },
      },
    )
  }, [senderAddress, run, setError, suiClient, getSenderAddress, sign, refetch])

  const addAddressAlias = useCallback(
    async (addressAlias: string): Promise<boolean> => {
      if (!senderAddress) {
        setError('Connect wallet first')
        return false
      }
      if (!objectId) {
        setError('Enable address aliasing first')
        return false
      }
      const validationError = validateNewAddressAlias({
        addressAlias,
        existing: addressAliases,
      })
      if (validationError) {
        setError(validationError)
        return false
      }
      const trimmed = addressAlias.trim()
      const digest = await run(
        () =>
          executeAddressAliasTx({
            suiClient,
            getSenderAddress,
            sign,
            buildBytes: (sender, client) =>
              addAddressAliasTxBytes(sender, objectId, trimmed, client),
          }),
        {
          fallbackMessage: 'Failed to add address alias',
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
      addressAliases,
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
    addressAliases,
    isReading,
    readError:
      readQueryError instanceof Error
        ? readQueryError.message
        : readQueryError
          ? 'Failed to read address aliases'
          : null,

    enable,
    addAddressAlias,
    refresh,

    isSubmitting,
    error,
    txDigest,
  }
}
