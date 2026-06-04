import { useMemo } from 'react'
import { useAuth } from '#/auth/hooks/useAuth'
import { useDevice } from '#/hooks/useDevice'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import { createSuiClient } from '#/sui'
import { isLocalnetChain } from '#/types/networks'
import { useLocalnetAddress } from './useLocalnetAddress'
import { useWalletSigningCallbacks } from './useWalletSigningContext.helpers'

export type WalletSigningMode = 'localnet' | 'zklogin'

export function useWalletSigningContext() {
  const { user } = useAuth()

  const { ephemeralPublicKey, getZkProof, maxEpoch, isLocked } = useDevice()
  const { chain } = useContextStore()
  const {
    localnet: { url: localnetUrl },
  } = useDeviceStore()
  const localnetAddress = useLocalnetAddress()
  const isLocalnet = isLocalnetChain(chain)

  const suiClient = useMemo(
    () => createSuiClient(chain, isLocalnet ? localnetUrl : undefined),
    [chain, isLocalnet, localnetUrl],
  )

  const senderAddress = isLocalnet
    ? localnetAddress
    : ((user?.profile?.sui_address as string | undefined) ?? null)

  const { getSenderAddress, sign } = useWalletSigningCallbacks({
    chain,
    isLocalnet,
    localnetAddress,
    getZkProof,
  })

  const isWalletUnlocked =
    !isLocked &&
    (isLocalnet ? !!localnetAddress : !!ephemeralPublicKey && !!maxEpoch)

  return {
    chain,
    localnetUrl,
    mode: (isLocalnet ? 'localnet' : 'zklogin') as WalletSigningMode,
    isLocalnet,
    isAuthenticated: !!user,
    isWalletUnlocked,
    senderAddress,
    localnetAddress,
    user,
    suiClient,
    getSenderAddress,
    sign,
  }
}
