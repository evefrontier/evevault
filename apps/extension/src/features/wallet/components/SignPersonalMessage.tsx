import { Text } from '@evevault/shared/components'
import type { PendingPersonalMessage } from '@evevault/shared/types'
import { createLogger, toErrorMessage } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { usePendingSignAction } from '@/features/wallet/hooks'
import { assertCanSign } from '@/features/wallet/transactionSigning'
import { SignRequestView } from './SignRequestView'

const log = createLogger()

/**
 * Converts the message field from a PendingPersonalMessage into a Uint8Array.
 * The message may arrive as a Uint8Array, a plain object with numeric keys
 * (after chrome.storage serialization), or a number array.
 */
function toMessageBytes(
  message: Uint8Array | Record<string, number> | number[],
): Uint8Array {
  if (message instanceof Uint8Array) {
    return message
  }
  if (Array.isArray(message)) {
    return new Uint8Array(message)
  }
  return new Uint8Array(Object.values(message))
}

/**
 * Decodes message bytes to a human-readable string.
 * Falls back to showing the raw byte count if decoding fails.
 */
function decodeMessageBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (err) {
    log.warn(
      'Failed to decode message bytes as UTF-8, falling back to byte count',
      err,
    )
    return `[binary message, ${bytes.length} bytes]`
  }
}

function parsePendingMessage(pendingAction: unknown): PendingPersonalMessage {
  return pendingAction as PendingPersonalMessage
}

function SignPersonalMessage() {
  const { chain, isLocalnet, sign } = useWalletSigningContext()
  const {
    pending: pendingMessage,
    loading,
    setLoading,
    error,
    setError,
    auth,
    handleReject,
    storeResult,
    storeErrorResult,
  } = usePendingSignAction({
    parsePending: parsePendingMessage,
    missingError: 'No pending message found',
    rejectError: 'Message signing rejected by user',
    rejectFailureError: 'Failed to reject message signing',
    rejectLogMessage: 'Failed to reject message signing',
    getWindowId: (pending) => pending.windowId,
  })

  const handleSignPersonalMessage = async () => {
    if (!pendingMessage) {
      log.error('No pending message found')
      return
    }
    try {
      setLoading(true)
      setError(null)

      const { message } = pendingMessage

      assertCanSign(auth, isLocalnet)

      const messageBytes = toMessageBytes(message)

      log.debug('Signing personal message', { length: messageBytes.length })

      const { bytes, signature } = await sign('PersonalMessage', messageBytes)

      const stored = await storeResult({ status: 'signed', bytes, signature })
      // A refused write (e.g. missing requestId) would strand the dApp request,
      // so keep the popup open and surface the error instead of closing.
      if (!stored) {
        setError('Failed to record the signing result. Please try again.')
        return
      }

      log.debug('Signed personal message')

      window.close()
    } catch (err) {
      log.error('Personal message signing failed', err)
      const errorMessage = toErrorMessage(err, 'Unknown error occurred')
      setError(errorMessage)
      await storeErrorResult(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SignRequestView
      auth={auth}
      title="Sign Personal Message"
      hasPending={!!pendingMessage}
      loading={loading}
      error={error}
      loadingMessage="Loading message..."
      chain={chain || SUI_TESTNET_CHAIN}
      dapp={pendingMessage?.dapp}
      accountAddress={pendingMessage?.account?.address}
      requestKind="Personal message"
      onApprove={handleSignPersonalMessage}
      onReject={handleReject}
    >
      {pendingMessage && (
        <div className="w-[320px] max-w-[88vw] border border-(--matter-05) p-3">
          <Text size="small" color="grey-neutral">
            Message
          </Text>
          <Text className="mt-2 max-h-28 overflow-y-auto wrap-break-word text-left">
            {decodeMessageBytes(toMessageBytes(pendingMessage.message))}
          </Text>
        </div>
      )}
    </SignRequestView>
  )
}

export default SignPersonalMessage
