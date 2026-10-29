import {
  ADDRESS_ALIASES_TYPE,
  addAddressAliasTxBytes,
  enableAddressAliasTxBytes,
  executeAddressAliasTx,
  removeAddressAliasTxBytes,
  type ValidateAddressAliasParams,
  validateAddressAliasRemoval,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from '@evefrontier/wallet-core/address-alias'
import type { ClientWithCoreApi } from '@mysten/sui/client'
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useToast } from '#/components'
import { isLocalnetChain } from '#/types/networks'
import { isAliasEnforcementFeatureEnabled } from '../aliasEnforcement'
import {
  setAddressAliasesData,
  useAddressAliasesQuery,
} from './useAddressAliases.query'
import { useTransactionWrite } from './useTransactionWrite'
import { useWalletSigningContext } from './useWalletSigningContext'

const NORMALIZED_ADDRESS_ALIASES_TYPE = normalizeStructTag(ADDRESS_ALIASES_TYPE)

const appendAlias = (aliases: string[], alias: string) => [...aliases, alias]

const withoutAlias = (aliases: string[], alias: string) =>
  aliases.filter((existing) => normalizeSuiAddress(existing) !== alias)

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

  // Write status
  isSubmitting: boolean
  error: string | null
  txDigest: string | null
}

/**
 * Hook for reading and managing address aliases.
 */
export function useAddressAliases(): UseAddressAliasesResult {
  const queryClient = useQueryClient()
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
      signTransaction: (bytes: Uint8Array) =>
        sign('TransactionData', bytes, { allowAddressAliasCalls: true }),
    }),
    [sign],
  )

  // Show toast when error occurs
  useEffect(() => {
    if (error) {
      showToast(error || 'Transaction failed')
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

  const enable = useCallback(async () => {
    if (!senderAddress) {
      setError('Connect wallet first')
      return
    }
    let createdObjectId: string | undefined
    await run(
      async () => {
        const digest = await executeAddressAliasTx({
          suiClient,
          sender: senderAddress,
          signer,
          buildBytes: enableAddressAliasTxBytes,
        })
        // The owned-object read can miss a just-created object, so take its
        // id from the effects.
        const { Transaction: transaction } =
          await suiClient.core.waitForTransaction({
            digest,
            include: { effects: true, objectTypes: true },
          })
        createdObjectId = transaction?.effects?.changedObjects.find(
          (object) => {
            const type = transaction.objectTypes?.[object.objectId]
            return (
              object.idOperation === 'Created' &&
              type != null &&
              normalizeStructTag(type) === NORMALIZED_ADDRESS_ALIASES_TYPE
            )
          },
        )?.objectId
        return digest
      },
      {
        fallbackMessage: 'Failed to enable address aliasing',
        onSuccess: async () => {
          if (!createdObjectId) {
            await refetch()
            return
          }
          const objectId = createdObjectId
          // `enable` registers the owner as the first alias.
          await setAddressAliasesData(
            queryClient,
            senderAddress,
            chain,
            () => ({
              enabled: true,
              objectId,
              addressAliases: [normalizeSuiAddress(senderAddress)],
            }),
          )
        },
      },
    )
  }, [
    senderAddress,
    run,
    setError,
    suiClient,
    signer,
    refetch,
    queryClient,
    chain,
  ])

  // Add and remove share the same guard → validate → build → sign → cache
  // update pipeline; only the validator, bytes builder, list change, and error
  // copy differ.
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
      applyChange: (aliases: string[], alias: string) => string[],
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
        async () => {
          const digest = await executeAddressAliasTx({
            suiClient,
            sender: senderAddress,
            signer,
            buildBytes: (sender, client) =>
              buildBytes(sender, objectId, trimmed, client),
          })
          // Wait for finality so the next alias transaction builds against
          // the updated object and gas coin.
          await suiClient.core.waitForTransaction({ digest })
          return digest
        },
        {
          fallbackMessage,
          onSuccess: async () => {
            const alias = normalizeSuiAddress(trimmed)
            await setAddressAliasesData(
              queryClient,
              senderAddress,
              chain,
              (previous) =>
                previous && {
                  ...previous,
                  addressAliases: applyChange(previous.addressAliases, alias),
                },
            )
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
      queryClient,
      chain,
    ],
  )

  const addAddressAlias = useCallback(
    (addressAlias: string) =>
      submitAliasChange(
        addressAlias,
        validateNewAddressAlias,
        addAddressAliasTxBytes,
        appendAlias,
        'Failed to add address alias',
      ),
    [submitAliasChange],
  )

  // Blocks removing the last non-self alias where enforcement applies;
  // otherwise only checks membership.
  const validateRemoval = useCallback(
    (params: ValidateAddressAliasParams): string | null => {
      if (
        !isAliasEnforcementFeatureEnabled() ||
        !chain ||
        isLocalnetChain(chain) ||
        !senderAddress
      ) {
        return validateExistingAddressAlias(params)
      }
      return validateAddressAliasRemoval({
        addressAlias: params.addressAlias,
        owner: senderAddress,
        info: { enabled, objectId, addressAliases: params.existing },
      })
    },
    [chain, senderAddress, enabled, objectId],
  )

  const removeAddressAlias = useCallback(
    (addressAlias: string) =>
      submitAliasChange(
        addressAlias,
        validateRemoval,
        removeAddressAliasTxBytes,
        withoutAlias,
        'Failed to remove address alias',
      ),
    [submitAliasChange, validateRemoval],
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
    isSubmitting,
    error,
    txDigest,
  }
}
