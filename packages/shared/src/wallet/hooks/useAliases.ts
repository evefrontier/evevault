import { useCallback, useMemo, useState } from 'react'
import { createLogger } from '#/utils'
import { MAX_ALIASES } from './useAliases.config'
import { useAddressAliases } from './useAliases.query'
import {
  buildAddAliasTx,
  buildEnableAliasesTx,
  executeAliasTransaction,
} from './useAliases.transaction'
import { validateNewAlias } from './useAliases.validation'
import { useWalletSigningContext } from './useWalletSigningContext'

const log = createLogger()

interface UseAliasesResult {
  // State
  isAuthenticated: boolean
  isWalletUnlocked: boolean
  ownerAddress: string | null
  enabled: boolean
  aliases: string[]
  maxAliases: number

  // Read status
  isReading: boolean
  readError: string | null

  // Actions
  enable: () => Promise<void>
  addAlias: (alias: string) => Promise<void>
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
  const {
    chain,
    isAuthenticated,
    isWalletUnlocked,
    senderAddress,
    suiClient,
    getSenderAddress,
    sign,
  } = useWalletSigningContext()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txDigest, setTxDigest] = useState<string | null>(null)

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

  const runWrite = useCallback(
    async (
      buildBytes: Parameters<typeof executeAliasTransaction>[0]['buildBytes'],
      failureMessage: string,
    ) => {
      setIsSubmitting(true)
      setError(null)
      setTxDigest(null)
      try {
        const digest = await executeAliasTransaction({
          suiClient,
          getSenderAddress,
          sign,
          buildBytes,
        })
        setTxDigest(digest)
        await refetch()
      } catch (err) {
        const message = err instanceof Error ? err.message : failureMessage
        log.error(failureMessage, err)
        setError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [suiClient, getSenderAddress, sign, refetch],
  )

  const enable = useCallback(async () => {
    if (!senderAddress) {
      setError('Connect wallet first')
      return
    }
    await runWrite(
      (sender, client) => buildEnableAliasesTx(sender, client),
      'Failed to enable aliasing',
    )
  }, [senderAddress, runWrite])

  const addAlias = useCallback(
    async (alias: string) => {
      if (!senderAddress) {
        setError('Connect wallet first')
        return
      }
      if (!objectId) {
        setError('Enable aliasing first')
        return
      }
      const validationError = validateNewAlias({ alias, existing: aliases })
      if (validationError) {
        setError(validationError)
        return
      }
      const trimmed = alias.trim()
      await runWrite(
        (sender, client) => buildAddAliasTx(sender, objectId, trimmed, client),
        'Failed to add alias',
      )
    },
    [senderAddress, objectId, aliases, runWrite],
  )

  return {
    isAuthenticated,
    isWalletUnlocked,
    ownerAddress: senderAddress,
    enabled,
    aliases,
    maxAliases: MAX_ALIASES,

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
