import { WalletStandardMessageTypes } from '@evevault/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleApprovePopup } from '@/lib/background/handlers/walletHandlers'
import type { WalletActionMessage } from '@/lib/background/types'

const { mockOpenPopupWindow, mockRequireDappPermission, logMethods } =
  vi.hoisted(() => ({
    mockOpenPopupWindow: vi.fn(),
    mockRequireDappPermission: vi.fn(),
    logMethods: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }))

vi.mock('@/lib/background/services/popupWindow', () => ({
  openPopupWindow: (action: string) => mockOpenPopupWindow(action),
}))

vi.mock('@/lib/background/services/dappPermissions', () => ({
  requireDappPermission: mockRequireDappPermission,
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logMethods,
  }
})

function installChromeMock(
  storageListeners: Array<
    (changes: { [key: string]: chrome.storage.StorageChange }) => void
  >,
  sendMessageImpl?: typeof chrome.tabs.sendMessage,
) {
  globalThis.chrome = {
    storage: {
      local: {
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(
          (
            fn: (changes: {
              [key: string]: chrome.storage.StorageChange
            }) => void,
          ) => {
            storageListeners.push(fn)
          },
        ),
        removeListener: vi.fn(),
      },
    },
    tabs: {
      sendMessage: sendMessageImpl ?? vi.fn(() => Promise.resolve()),
    },
  } as unknown as typeof chrome
}

describe('handleApprovePopup', () => {
  let storageListeners: Array<
    (changes: { [key: string]: chrome.storage.StorageChange }) => void
  >

  beforeEach(() => {
    storageListeners = []
    mockOpenPopupWindow.mockResolvedValue(99)
    mockRequireDappPermission.mockResolvedValue({
      allowed: true,
      context: { origin: 'https://example.test' },
    })
    installChromeMock(storageListeners)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  async function getWrappedListener(
    message: WalletActionMessage,
    sender: {
      tab?: { id?: number }
    },
  ) {
    await handleApprovePopup(
      message,
      sender as chrome.runtime.MessageSender,
      vi.fn(),
    )
    const wrapped = storageListeners[storageListeners.length - 1]
    if (!wrapped) {
      throw new Error('expected storage onChanged listener to be registered')
    }
    return wrapped
  }

  describe('dApp permissions', () => {
    it('rejects signing when the requesting origin is not connected', async () => {
      mockRequireDappPermission.mockResolvedValueOnce({
        allowed: false,
        error: 'Connect this site to EVE Vault before requesting a signature.',
      })
      const sendResponse = vi.fn()

      const result = await handleApprovePopup(
        {
          id: 'req-denied',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 42 } } as chrome.runtime.MessageSender,
        sendResponse,
      )

      expect(result).toBe(false)
      expect(mockOpenPopupWindow).not.toHaveBeenCalled()
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_transaction_error',
        error: 'Connect this site to EVE Vault before requesting a signature.',
        id: 'req-denied',
      })
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'sign_transaction_error',
        error: 'Connect this site to EVE Vault before requesting a signature.',
        id: 'req-denied',
      })
    })
  })

  describe('when opening the popup fails', () => {
    it('calls sendResponse with sign_transaction_error when windowId is falsy', async () => {
      mockOpenPopupWindow.mockResolvedValue(undefined as unknown as number)
      const sendResponse = vi.fn()

      const result = await handleApprovePopup(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        { tab: { id: 1 } } as chrome.runtime.MessageSender,
        sendResponse,
      )

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'sign_transaction_error',
        error: 'Failed to open approval popup',
      })
      expect(logMethods.error).toHaveBeenCalled()
    })

    it('calls sendResponse with Error message when openPopupWindow throws an Error', async () => {
      mockOpenPopupWindow.mockRejectedValue(new Error('popup crashed'))
      const sendResponse = vi.fn()

      const result = await handleApprovePopup(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        { tab: { id: 1 } } as chrome.runtime.MessageSender,
        sendResponse,
      )

      expect(result).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'sign_transaction_error',
        error: 'popup crashed',
      })
    })

    it('calls sendResponse with the message when openPopupWindow throws a string', async () => {
      mockOpenPopupWindow.mockRejectedValue('boom')
      const sendResponse = vi.fn()

      await handleApprovePopup(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        { tab: { id: 1 } } as chrome.runtime.MessageSender,
        sendResponse,
      )

      expect(sendResponse).toHaveBeenCalledWith({
        type: 'sign_transaction_error',
        error: 'boom',
        id: undefined,
      })
    })
  })

  describe('on transactionResult success', () => {
    it('sends sign_success for SIGN_TRANSACTION when status is signed', async () => {
      const wrapped = await getWrappedListener(
        {
          id: 's1',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 42 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed',
            bytes: new Uint8Array([1, 2]),
            signature: 'sig-bytes',
          },
        },
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_success',
        bytes: new Uint8Array([1, 2]),
        signature: 'sig-bytes',
        id: 's1',
      })
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'pendingAction',
        'transactionResult',
      ])
    })

    it('sends sign_and_execute_transaction_success when all required fields are present', async () => {
      const wrapped = await getWrappedListener(
        {
          id: 's2',
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        },
        { tab: { id: 7 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed_and_executed',
            bytes: new Uint8Array([9]),
            signature: 'sig',
            digest: 'dg',
            effects: 'fx',
          },
        },
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: 'sign_and_execute_transaction_success',
        result: {
          bytes: new Uint8Array([9]),
          signature: 'sig',
          digest: 'dg',
          effects: 'fx',
        },
        id: 's2',
      })
    })

    it('sends sign_and_execute_transaction_error when digest or effects are missing', async () => {
      const wrapped = await getWrappedListener(
        {
          id: 's3',
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        },
        { tab: { id: 7 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed_and_executed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
          },
        },
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: 'sign_and_execute_transaction_error',
        error: 'Missing bytes or signature in transaction result',
        id: 's3',
      })
    })

    it('logs when tabs.sendMessage rejects on sign_success', async () => {
      const sendMessage = vi.fn(() => Promise.reject(new Error('tab gone')))
      installChromeMock(storageListeners, sendMessage)
      mockOpenPopupWindow.mockResolvedValue(99)

      const wrapped = await getWrappedListener(
        {
          id: 's4',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 1 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
          },
        },
      })

      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          'Failed to send message to tab',
          expect.objectContaining({ err: new Error('tab gone') }),
        )
      })
    })

    it('logs when tabs.sendMessage rejects for incomplete sign-and-execute result', async () => {
      const sendMessage = vi.fn(() => Promise.reject(new Error('tab gone')))
      installChromeMock(storageListeners, sendMessage)
      mockOpenPopupWindow.mockResolvedValue(99)

      const wrapped = await getWrappedListener(
        {
          id: 's5',
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        },
        { tab: { id: 3 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed_and_executed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
          },
        },
      })

      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          'Failed to send message to tab',
          expect.objectContaining({ err: new Error('tab gone') }),
        )
      })
    })

    it('logs when tabs.sendMessage rejects for sign-and-execute success', async () => {
      const sendMessage = vi.fn(() => Promise.reject(new Error('tab gone')))
      installChromeMock(storageListeners, sendMessage)
      mockOpenPopupWindow.mockResolvedValue(99)

      const wrapped = await getWrappedListener(
        {
          id: 's6',
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        },
        { tab: { id: 3 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed_and_executed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
            digest: 'd',
            effects: 'e',
          },
        },
      })

      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          'Failed to send message to tab',
          expect.objectContaining({ err: new Error('tab gone') }),
        )
      })
    })
  })

  describe('on transactionResult error', () => {
    async function fireTransactionError(
      message: WalletActionMessage,
      sender: { tab?: { id?: number } } = { tab: { id: 42 } },
      errorPayload: unknown = 'User said no',
    ) {
      const wrapped = await getWrappedListener(message, sender)
      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'error',
            error: errorPayload,
          },
        },
      })
    }

    it('maps SIGN_TRANSACTION to sign_transaction_error', async () => {
      await fireTransactionError({
        id: 'req-1',
        action: WalletStandardMessageTypes.SIGN_TRANSACTION,
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_transaction_error',
        error: 'User said no',
        id: 'req-1',
      })
      expect(logMethods.warn).not.toHaveBeenCalled()
    })

    it('removeListener is called with the same handler reference as addListener', async () => {
      const wrapped = await getWrappedListener(
        {
          id: 'req-remove-pair',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 42 } },
      )

      expect(storageListeners).toHaveLength(1)
      const registered = storageListeners[0]
      if (!registered) {
        throw new Error('expected registered storage listener')
      }

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'error',
            error: 'User said no',
          },
        },
      })

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(
        registered,
      )
    })

    it('maps SIGN_PERSONAL_MESSAGE to sign_personal_message_error', async () => {
      await fireTransactionError({
        id: 'req-2',
        action: WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_personal_message_error',
        error: 'User said no',
        id: 'req-2',
      })
      expect(logMethods.warn).not.toHaveBeenCalled()
    })

    it('normalizes structured error payloads before sending to the page', async () => {
      await fireTransactionError(
        {
          id: 'req-structured-error',
          action: WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
        },
        { tab: { id: 42 } },
        { message: 'approval object failure' },
      )

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_personal_message_error',
        error: 'approval object failure',
        id: 'req-structured-error',
      })
    })

    it('maps unknown action to sign_error and logs a warning', async () => {
      await fireTransactionError({
        id: 'req-3',
        action: 'unknown_wallet_action_for_test',
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_error',
        error: 'User said no',
        id: 'req-3',
      })
      expect(logMethods.warn).toHaveBeenCalledWith('Unknown action', {
        action: 'unknown_wallet_action_for_test',
      })
    })

    it('uses sign_and_execute_transaction_error for SIGN_AND_EXECUTE_TRANSACTION', async () => {
      await fireTransactionError({
        id: 'req-4',
        action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
      })

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        type: 'sign_and_execute_transaction_error',
        error: 'User said no',
        id: 'req-4',
      })
      expect(logMethods.warn).not.toHaveBeenCalled()
    })

    it('does not call tabs.sendMessage when sender has no tab id (non-execute error)', async () => {
      await fireTransactionError(
        {
          id: 'req-5',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        {},
      )

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('does not call tabs.sendMessage when sender has no tab id (sign-and-execute error)', async () => {
      await fireTransactionError(
        {
          id: 'req-6',
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        },
        {},
      )

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('logs when tabs.sendMessage rejects for mapped error type', async () => {
      const sendMessage = vi.fn(() => Promise.reject(new Error('tab gone')))
      installChromeMock(storageListeners, sendMessage)
      mockOpenPopupWindow.mockResolvedValue(99)

      await fireTransactionError({
        id: 'req-7',
        action: WalletStandardMessageTypes.SIGN_TRANSACTION,
      })

      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          'Failed to send message to tab',
          expect.objectContaining({ err: new Error('tab gone') }),
        )
      })
    })

    it('logs when tabs.sendMessage rejects for sign-and-execute error result', async () => {
      const sendMessage = vi.fn(() => Promise.reject(new Error('tab gone')))
      installChromeMock(storageListeners, sendMessage)
      mockOpenPopupWindow.mockResolvedValue(99)

      await fireTransactionError({
        id: 'req-8',
        action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
      })

      await vi.waitFor(() => {
        expect(logMethods.error).toHaveBeenCalledWith(
          'Failed to send message to tab',
          expect.objectContaining({ err: new Error('tab gone') }),
        )
      })
    })
  })

  describe('when storage change is irrelevant', () => {
    it('does nothing when transactionResult is absent', async () => {
      const wrapped = await getWrappedListener(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        { tab: { id: 1 } },
      )

      wrapped({})

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
      expect(chrome.storage.local.remove).not.toHaveBeenCalled()
    })

    it('ignores transactionResult for a different popup window', async () => {
      const wrapped = await getWrappedListener(
        {
          id: 'mismatched-window',
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 1 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 123,
            status: 'signed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
          },
        },
      })

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
      expect(chrome.storage.local.remove).not.toHaveBeenCalled()
      expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
    })

    it('does nothing on success when sender has no tab id', async () => {
      const wrapped = await getWrappedListener(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        {},
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed',
            bytes: new Uint8Array([1]),
            signature: 'sig',
          },
        },
      })

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
      expect(chrome.storage.local.remove).not.toHaveBeenCalled()
    })
  })

  describe('approval timeout', () => {
    it('removes pending storage and logs after 10 minutes', async () => {
      vi.useFakeTimers()

      await handleApprovePopup(
        {
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        },
        { tab: { id: 5 } } as chrome.runtime.MessageSender,
        vi.fn(),
      )

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(logMethods.warn).toHaveBeenCalledWith(
        'Transaction approval timed out',
        {
          action: WalletStandardMessageTypes.SIGN_TRANSACTION,
          senderTabId: 5,
        },
      )
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'pendingAction',
        'transactionResult',
      ])
    })

    it('clears the timeout when a storage result arrives', async () => {
      vi.useFakeTimers()

      const wrapped = await getWrappedListener(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION },
        { tab: { id: 2 } },
      )

      wrapped({
        transactionResult: {
          newValue: {
            windowId: 99,
            status: 'signed',
            bytes: new Uint8Array([1]),
            signature: 's',
          },
        },
      })

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(logMethods.warn).not.toHaveBeenCalledWith(
        'Transaction approval timed out',
        expect.anything(),
      )
    })
  })
})
