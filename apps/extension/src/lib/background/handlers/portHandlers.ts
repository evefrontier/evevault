import { createLogger } from '@evevault/shared/utils'
import { type Browser, browser } from 'wxt/browser'

const log = createLogger()

function handlePortConnection(port: Browser.runtime.Port) {
  log.info('Port connected', { name: port.name })

  // Listen for logout requests
  browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.action === 'logout') {
      port.postMessage({ action: 'logout' })
    }
  })
}

export { handlePortConnection }
