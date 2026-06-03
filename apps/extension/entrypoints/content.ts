import { createLogger } from '@evevault/shared/utils'
import { CONTEXT_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'

const log = createLogger()

function resolveCurrentChain(): Promise<string> {
  return new Promise((resolve) => {
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
      resolve(chain)
    })
  })
}

async function handleGetCurrentChain() {
  const chain = await resolveCurrentChain()
  window.postMessage(
    { __from: 'Eve Vault', event: 'change', payload: { chains: [chain] } },
    '*',
  )
}

function handleWindowMessage(event: MessageEvent) {
  if (event.source !== window) return

  const data = (event.data || {}) as Record<string, unknown>
  if (data.__from === 'Eve Vault') return

  if (data.__to === 'Eve Vault' && data.type === 'get_current_chain') {
    void handleGetCurrentChain()
    return
  }

  if (typeof data.type === 'string' || typeof data.action === 'string') {
    chrome.runtime.sendMessage(data)
  }
}

function forwardToPage(message: Record<string, unknown>) {
  const id = (message.id as string) || undefined
  const type = (message.type as string) || ''
  window.postMessage({ __from: 'Eve Vault', id, type, ...message }, '*')
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    log.info('Eve Vault content script loaded')

    const injectScript = document.createElement('script')
    injectScript.src = chrome.runtime.getURL('injected.js')
    ;(document.head || document.documentElement).appendChild(injectScript)

    window.addEventListener('message', handleWindowMessage)
    chrome.runtime.onMessage.addListener(forwardToPage)
  },
})
