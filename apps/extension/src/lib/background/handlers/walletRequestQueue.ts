import type {
  EveFrontierSponsoredTransactionMessage,
  WalletActionMessage,
} from "../types";

const tabsInProgress = new Set<number>();
const queue = new Map<number, QueuedWalletRequest[]>();

export type QueuedSignRequest = {
  kind: "sign";
  message: WalletActionMessage;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response?: unknown) => void;
};

export type QueuedSponsoredRequest = {
  kind: "sponsored";
  message: EveFrontierSponsoredTransactionMessage;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response?: unknown) => void;
};

export type QueuedWalletRequest = QueuedSignRequest | QueuedSponsoredRequest;

export function setTabInProgress(tabId: number): void {
  tabsInProgress.add(tabId);
}

export function clearTabInProgress(tabId: number): void {
  tabsInProgress.delete(tabId);
}

export function hasPendingForTab(tabId: number): boolean {
  return tabsInProgress.has(tabId);
}

export function enqueue(tabId: number, request: QueuedWalletRequest): void {
  const list = queue.get(tabId) ?? [];
  list.push(request);
  queue.set(tabId, list);
}

export function dequeueNext(tabId: number): QueuedWalletRequest | null {
  const list = queue.get(tabId);
  if (!list?.length) return null;
  const next = list.shift() ?? null;
  if (list.length === 0) queue.delete(tabId);
  return next;
}

/**
 * Call after the current wallet action completes for this tab.
 * Dequeues the next request (if any) and runs the appropriate handler.
 */
export function processNextWalletRequest(tabId: number): void {
  clearTabInProgress(tabId);
  const next = dequeueNext(tabId);
  if (!next) return;
  if (next.kind === "sign") {
    import("./walletHandlers").then(({ handleApprovePopup }) => {
      void handleApprovePopup(next.message, next.sender, next.sendResponse);
    });
  } else {
    import("./sponsoredTransactionHandler").then(
      ({ handleSponsoredTransaction }) => {
        void handleSponsoredTransaction(
          next.message,
          next.sender,
          next.sendResponse,
        );
      },
    );
  }
}
