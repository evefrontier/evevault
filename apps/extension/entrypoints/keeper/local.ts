import { encryptWithKey, signWithIntent } from '@evevault/shared'
import type { IntentScope } from '@mysten/sui/cryptography'
import { SUI_PRIVATE_KEY_PREFIX } from '@mysten/sui/cryptography'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import type { BackgroundMessage } from '@/lib/background/types'

type LocalnetState = {
  localnetKey: Ed25519Keypair | null
}

const localnetSetKeypair = async (
  localnetState: LocalnetState,
  sessionDerivedKey: CryptoKey,
  sessionSalt: string,
  message: BackgroundMessage,
  sendResponse: (response?: unknown) => void,
) => {
  const { privateKey } = message as { privateKey?: string }
  if (!privateKey) {
    sendResponse({ ok: false, error: 'privateKey required' })
    return
  }
  if (!sessionDerivedKey || !sessionSalt) {
    sendResponse({
      ok: false,
      error: 'Vault must be unlocked to store localnet key',
    })
    return
  }
  try {
    if (!privateKey.startsWith(`${SUI_PRIVATE_KEY_PREFIX}1`)) {
      throw new Error('Invalid private key')
    }
    localnetState.localnetKey = Ed25519Keypair.fromSecretKey(privateKey)
    const address = localnetState.localnetKey.getPublicKey().toSuiAddress()
    // Encrypt and return the blob to the background script for storage
    // (offscreen documents cannot access chrome.storage)
    const encryptedKey = await encryptWithKey(
      privateKey,
      sessionDerivedKey,
      sessionSalt,
    )
    sendResponse({ ok: true, address, encryptedKey })
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const localnetGetAddress = (
  state: LocalnetState,
  sendResponse: (response: {
    ok: boolean
    address?: string | null
    error?: string
  }) => void,
) => {
  if (!state.localnetKey) {
    sendResponse({ ok: true, address: null })
  } else {
    sendResponse({
      ok: true,
      address: state.localnetKey.getPublicKey().toSuiAddress(),
    })
  }
}

const localnetSign = async (
  state: LocalnetState,
  message: BackgroundMessage,
  sendResponse: (response: {
    ok: boolean
    bytes?: string
    signature?: string
    error?: string
  }) => void,
) => {
  const key = state.localnetKey
  if (!key) {
    sendResponse({ ok: false, error: 'No localnet keypair loaded' })
    return
  }

  try {
    const { msgBytes, scope, suiAddress } = message as {
      msgBytes: number[]
      scope: IntentScope
      suiAddress: string
    }

    const messageBytes = new Uint8Array(msgBytes)
    const result = await signWithIntent(messageBytes, scope, {
      sui_address: suiAddress,
      keypair: key,
    })

    sendResponse({
      ok: true,
      bytes: result.bytes,
      signature: result.userSignature,
    })
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export type { LocalnetState }
export { localnetSetKeypair, localnetGetAddress, localnetSign }
