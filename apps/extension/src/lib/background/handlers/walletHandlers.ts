import { WalletStandardMessageTypes } from '@evevault/shared';
import { createLogger } from '@evevault/shared/utils';
import { openPopupWindow } from '@/lib/background/services/popupWindow';
import type { WalletActionMessage } from '@/lib/background/types';

const log = createLogger();

async function handleApprovePopup(
  message: WalletActionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { action } = message;

  try {
    log.info('Wallet action request received', { action: message.action });

    const senderTabId = sender.tab?.id;

    const windowId = await openPopupWindow(action);

    if (!windowId) {
      throw new Error('Failed to open approval popup');
    }

    await chrome.storage.local.set({
      pendingAction: {
        ...message,
        windowId,
        senderTabId,
        timestamp: Date.now(),
      },
    });

    const isSignAndExecute =
      action === WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION;

    let timeoutId: ReturnType<typeof setTimeout>;
    let registeredListener: (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => void;

    const detachApprovalListener = () => {
      clearTimeout(timeoutId);
      chrome.storage.onChanged.removeListener(registeredListener);
    };

    const coreListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const result = changes.transactionResult?.newValue;

      const isSuccess =
        result?.status === 'signed' || result?.status === 'signed_and_executed';
      if (isSuccess && senderTabId) {
        if (isSignAndExecute) {
          const hasRequired =
            result.bytes != null &&
            result.signature != null &&
            result.digest != null &&
            result.effects != null;
          if (!hasRequired) {
            chrome.tabs
              .sendMessage(senderTabId, {
                type: 'sign_and_execute_transaction_error',
                error: 'Missing bytes or signature in transaction result',
                id: message.id,
              })
              .catch((err) => {
                log.error('Failed to send sign_and_execute error', err);
              });
          } else {
            chrome.tabs
              .sendMessage(senderTabId, {
                type: 'sign_and_execute_transaction_success',
                result: {
                  bytes: result.bytes,
                  signature: result.signature,
                  digest: result.digest,
                  effects: result.effects,
                },
                id: message.id,
              })
              .catch((err) => {
                log.error('Failed to send sign_and_execute success', err);
              });
          }
        } else {
          chrome.tabs
            .sendMessage(senderTabId, {
              type: 'sign_success',
              bytes: result.bytes,
              signature: result.signature,
              id: message.id,
            })
            .catch((err) => {
              log.error('Failed to send success message', err);
            });
        }

        chrome.storage.local.remove(['pendingAction', 'transactionResult']);
        detachApprovalListener();
      } else if (result?.status === 'error') {
        detachApprovalListener();

        if (isSignAndExecute && senderTabId) {
          chrome.tabs
            .sendMessage(senderTabId, {
              type: 'sign_and_execute_transaction_error',
              error: result.error,
              id: message.id,
            })
            .catch((err) => {
              log.error('Failed to send sign_and_execute error', err);
            });
        } else if (typeof senderTabId === 'number') {
          let errorType: string;

          switch (action) {
            case WalletStandardMessageTypes.SIGN_TRANSACTION:
              errorType = 'sign_transaction_error';
              break;
            case WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE:
              errorType = 'sign_personal_message_error';
              break;
            default:
              log.warn('Unknown action', { action });
              errorType = 'sign_error';
              break;
          }

          chrome.tabs
            .sendMessage(senderTabId, {
              type: errorType,
              error: result.error,
              id: message.id,
            })
            .catch((err) => {
              log.error(`Failed to send ${errorType} error`, err);
            });
        }

        chrome.storage.local.remove(['pendingAction', 'transactionResult']);
      }
    };

    registeredListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      clearTimeout(timeoutId);
      coreListener(changes);
    };

    timeoutId = setTimeout(
      () => {
        detachApprovalListener();
        chrome.storage.local.remove(['pendingAction', 'transactionResult']);
        log.warn('Transaction approval timed out', { action, senderTabId });
      },
      10 * 60 * 1000,
    );

    chrome.storage.onChanged.addListener(registeredListener);

    return true; // Keep message channel open for async response
  } catch (error) {
    log.error('Transaction signing failed', error);
    sendResponse({
      type: 'sign_transaction_error',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
    return false;
  }
}

export { handleApprovePopup };
