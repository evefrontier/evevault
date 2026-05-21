import { createLogger } from '@evevault/shared/utils'
import { CONTEXT_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'

const log = createLogger()

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    log.info('Eve Vault content script loaded')

    const injectScript = document.createElement('script')
    injectScript.src = chrome.runtime.getURL('injected.js')

    ;(document.head || document.documentElement).appendChild(injectScript)

    // Remove the script element after it loads (optional cleanup)
    // injectScript.onload = () => injectScript.remove();

    // Listen for messages from the page
    window.addEventListener('message', (event) => {
      if (event.source !== window) return

      const data = event.data || {}
      if (data.__from === 'Eve Vault') return

      // Handle initial-chain request from the injected wallet script.
      // Respond directly from the content script (which has storage access)
      // so the injected wallet can seed #currentChain before any dApp connects.
      if (data.__to === 'Eve Vault' && data.type === 'get_current_chain') {
        chrome.storage.local.get([CONTEXT_STORAGE_KEY], (result) => {
          let chain = 'sui:testnet'
          try {
            const stored = result[CONTEXT_STORAGE_KEY]
            if (stored) {
              const parsed =
                typeof stored === 'string' ? JSON.parse(stored) : stored
              if (parsed?.state?.chain) chain = parsed.state.chain
            }
          } catch {
            // fall back to testnet
          }
          window.postMessage(
            {
              __from: 'Eve Vault',
              event: 'change',
              payload: { chains: [chain] },
            },
            '*',
          )
        })
        return // do not forward to background
      }

      const shouldForward =
        typeof data.type === 'string' || typeof data.action === 'string'

      if (shouldForward) {
        chrome.runtime.sendMessage(data)
        return
      }
    })

    // Listen for responses from background script and forward to page
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      const id = (message && (message.id as string)) || undefined
      const type = (message && (message.type as string)) || ''

      // Forward all messages from background to page context
      // This includes chain change events, logout events, etc.
      window.postMessage({ __from: 'Eve Vault', id, type, ...message }, '*')
    })
  },
})
