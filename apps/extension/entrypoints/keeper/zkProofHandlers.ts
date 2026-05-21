import type { ZkProofResponse } from '@evevault/shared'
import type { SuiChain } from '@mysten/wallet-standard'
import type { BackgroundMessage } from '@/lib/background/types'
import {
  clearZkProofs,
  enforceExpiry,
  getEphemeralKey,
  getZkProof,
  setZkProof,
} from './keeperState'
import type { KeeperSendResponse } from './keeperTypes'

export function handleSetZkProof(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const { chain, zkProof } = message

  if (enforceExpiry() || !getEphemeralKey()) {
    sendResponse({
      error: '[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED',
    })
    return false
  }

  if (!chain) {
    sendResponse({ error: 'Chain is required' })
    return false
  }

  setZkProof(chain as SuiChain, zkProof as ZkProofResponse)
  sendResponse({ ok: true })
  return false
}

export function handleGetZkProof(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const { chain } = message

  if (enforceExpiry() || !getEphemeralKey()) {
    sendResponse({ error: 'LOCKED' })
    return false
  }

  if (!chain) {
    sendResponse({ error: 'Chain is required' })
    return false
  }

  sendResponse({ ok: true, zkProof: getZkProof(chain as SuiChain) })
  return false
}

export function handleClearZkProof(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  clearZkProofs()
  sendResponse({ ok: true })
  return false
}
