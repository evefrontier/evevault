import {
  addAddressAliasTxBytes,
  addressAliasesObjectId,
  enableAddressAliasTxBytes,
  executeAddressAliasTx,
  removeAddressAliasTxBytes,
  type ValidateAddressAliasParams,
  validateAddressAliasRemoval,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from '@evefrontier/wallet-core/address-alias'
import type { ClientWithCoreApi } from '@mysten/sui/client'
import { normalizeSuiAddress } from '@mysten/sui/utils'
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

// Skips the append when a refetch that completed before the update already
// includes the alias.
const appendAlias = (aliases: string[], alias: string) =>
  aliases.some((existing) => normalizeSuiAddress(existing) === alias)
    ? aliases
    : [...aliases, alias]

const withoutAlias = (aliases: string[], alias: string) =>
  aliases.filter((existing) => normalizeSuiAddress(existing) !== alias)

// Waits for finality so the next alias transaction builds against the
// updated object and gas coin.
async function executeAliasTxAndWait(
  params: Parameters<typeof executeAddressAliasTx>[0],
): Promise<string> {
  const digest = await executeAddressAliasTx(params)
  await params.suiClient.core.waitForTransaction({ digest })
  return digest
}

// Blocks removing the last non-self alias where enforcement applies;
// otherwise only checks membership.
function validateRemovalFor(
  params: ValidateAddressAliasParams,
  chain: string | null | undefined,
  owner: string | null,
  enabled: boolean,
): string | null {
  if (
    !isAliasEnforcementFeatureEnabled() ||
    !chain ||
    isLocalnetChain(chain) ||
    !owner
  ) {
    return validateExistingAddressAlias(params)
  }
  return validateAddressAliasRemoval({
    addressAlias: params.addressAlias,
    owner,
    info: {
      enabled,
      objectId: enabled ? addressAliasesObjectId(owner) : undefined,
      addressAliases: params.existing,
    },
  })
}

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
  } = useAddressAliasesQuery({ owner: senderAddress, suiClient, chain })

  const enabled = data?.enabled ?? false
  const addressAliases = useMemo(
    () => data?.addressAliases ?? [],
    [data?.addressAliases],
  )

  const enable = useCallback(async () => {
    if (!senderAddress) {
      setError('Connect wallet first')
      return
    }
    await run(
      () =>
        executeAliasTxAndWait({
          suiClient,
          sender: senderAddress,
          signer,
          buildBytes: enableAddressAliasTxBytes,
        }),
      {
        fallbackMessage: 'Failed to enable address aliasing',
        onSuccess: async () => {
          // `enable` registers the owner as the first alias.
          await setAddressAliasesData(
            queryClient,
            senderAddress,
            chain,
            () => ({
              enabled: true,
              objectId: addressAliasesObjectId(senderAddress),
              addressAliases: [normalizeSuiAddress(senderAddress)],
            }),
          )
        },
      },
    )
  }, [senderAddress, run, setError, suiClient, signer, queryClient, chain])

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
      if (!senderAddress || !enabled) {
        setError(
          senderAddress
            ? 'Enable address aliasing first'
            : 'Connect wallet first',
        )
        return false
      }
      const objectId = addressAliasesObjectId(senderAddress)
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
          executeAliasTxAndWait({
            suiClient,
            sender: senderAddress,
            signer,
            buildBytes: (sender, client) =>
              buildBytes(sender, objectId, trimmed, client),
          }),
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
      enabled,
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

  const validateRemoval = useCallback(
    (params: ValidateAddressAliasParams) =>
      validateRemovalFor(params, chain, senderAddress, enabled),
    [chain, senderAddress, enabled],
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
