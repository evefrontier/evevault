import { Transaction } from '@mysten/sui/transactions'
import { useCallback, useState } from 'react'
import { useToast } from '#/components'
import { useDeviceStore } from '#/stores'
import { isZkLoginSuiChain } from '#/types/networks'
import { createLogger } from '#/utils'
import { useWalletSigningContext } from '#/wallet/hooks/useWalletSigningContext'
import { signAndExecuteTransaction } from '#/wallet/signAndExecute'
import { useContext } from './useContext'
import { useDevice } from './useDevice'

const log = createLogger()

/**
 * Hook for handling test transaction submission
 */
export function useDevMode() {
  const { rotateEphemeralKey } = useDevice()
  const { chain } = useContext()
  const {
    isLocalnet,
    isAuthenticated,
    isWalletUnlocked,
    suiClient,
    getSenderAddress,
    sign,
  } = useWalletSigningContext()
  const { showToast } = useToast()
  const [txDigest, setTxDigest] = useState<string | null>(null)

  const handleTestTransaction = useCallback(async () => {
    try {
      const senderAddress = await getSenderAddress()
      if (!senderAddress) {
        throw new Error('Wallet not ready to sign')
      }

      const tx = new Transaction()
      tx.setSender(senderAddress)
      const txb = await tx.build({ client: suiClient })
      const digest = await signAndExecuteTransaction({
        chain,
        suiClient,
        txBytes: new Uint8Array(txb),
        sign,
      })

      setTxDigest(digest)
      showToast('Transaction submitted!')
    } catch (error) {
      log.error('Error submitting transaction', error)
      showToast('Error submitting transaction')
    }
  }, [chain, suiClient, getSenderAddress, sign, showToast])

  const formatPublicKey = useCallback((bytes: number[] | null | undefined) => {
    if (!bytes || bytes.length === 0) return null
    return bytes
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }, [])

  const handleRotateEphKey = useCallback(async () => {
    const beforeState = useDeviceStore.getState()
    const beforeChainData = isZkLoginSuiChain(chain)
      ? beforeState.networkData[chain]
      : null
    const beforeKey = formatPublicKey(beforeState.ephemeralPublicKeyBytes)

    log.info('Manual eph key rotation requested', {
      chain,
      beforeKey,
      maxEpoch: beforeChainData?.maxEpoch,
      hasNonce: beforeChainData?.nonce != null,
      hasJwtRandomness: beforeChainData?.jwtRandomness != null,
    })

    try {
      await rotateEphemeralKey(chain)

      const afterState = useDeviceStore.getState()
      const afterChainData = isZkLoginSuiChain(chain)
        ? afterState.networkData[chain]
        : null
      const afterKey = formatPublicKey(afterState.ephemeralPublicKeyBytes)

      log.info('Manual eph key rotation completed', {
        chain,
        beforeKey,
        afterKey,
        maxEpoch: afterChainData?.maxEpoch,
        hasNonce: afterChainData?.nonce != null,
        hasJwtRandomness: afterChainData?.jwtRandomness != null,
      })
    } catch (error) {
      log.error('Manual eph key rotation failed', error)
    }
  }, [chain, formatPublicKey, rotateEphemeralKey])

  return {
    handleTestTransaction,
    txDigest,
    handleRotateEphKey,
    isAuthenticated: isLocalnet ? isWalletUnlocked : isAuthenticated,
  }
}
