import {
  addAddressAliasTxBytes,
  enableAddressAliasTxBytes,
  executeAddressAliasTx,
  removeAddressAliasTxBytes,
  type ValidateAddressAliasParams,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from '@evefrontier/wallet-core/address-alias'
import type { ClientWithCoreApi } from '@mysten/sui/client'
import { useCallback, useEffect, useMemo } from 'react'
import { useToast } from '#/components'
import { useAddressAliasesQuery } from './useAddressAliases.query'
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
  removeAddressAlias: (addressAlias: string) => Promise<boolean>
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
    sign,
  } = useWalletSigningContext()

  // Adapts the signing-context callback to wallet-core's signer shape.
  const signer = useMemo(
    () => ({
      signTransaction: (bytes: Uint8Array) => sign('TransactionData', bytes),
    }),
    [sign],
  )

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
          sender: senderAddress,
          signer,
          buildBytes: enableAddressAliasTxBytes,
        }),
      {
        fallbackMessage: 'Failed to enable address aliasing',
        onSuccess: async () => {
          await refetch()
        },
      },
    )
  }, [senderAddress, run, setError, suiClient, signer, refetch])

  // Add and remove share the same guard → validate → build → sign → refetch
  // pipeline; only the validator, bytes builder, and error copy differ.
  const submitAliasChange = useCallback(
    async (
      addressAlias: string,
      validate: (params: ValidateAddressAliasParams) => string | null,
      buildBytes: (
        sender: string,
        objectId: string,
        alias: string,
        client: ClientWithCoreApi,
      ) => Promise<Uint8Array>,
      fallbackMessage: string,
    ): Promise<boolean> => {
      if (!senderAddress) {
        setError('Connect wallet first')
        return false
      }
      if (!objectId) {
        setError('Enable address aliasing first')
        return false
      }
      const validationError = validate({
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
            sender: senderAddress,
            signer,
            buildBytes: (sender, client) =>
              buildBytes(sender, objectId, trimmed, client),
          }),
        {
          fallbackMessage,
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
      signer,
      refetch,
    ],
  )

  const addAddressAlias = useCallback(
    (addressAlias: string) =>
      submitAliasChange(
        addressAlias,
        validateNewAddressAlias,
        addAddressAliasTxBytes,
        'Failed to add address alias',
      ),
    [submitAliasChange],
  )

  const removeAddressAlias = useCallback(
    (addressAlias: string) =>
      submitAliasChange(
        addressAlias,
        validateExistingAddressAlias,
        removeAddressAliasTxBytes,
        'Failed to remove address alias',
      ),
    [submitAliasChange],
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
    removeAddressAlias,
    refresh,
    isSubmitting,
    error,
    txDigest,
  }
}
