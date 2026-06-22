type MsgSender = chrome.runtime.MessageSender

/**
 * Identifies messages that originate from this extension rather than a web
 * page. Fails closed: a sender is trusted only when it carries a URL under this
 * extension's own origin. Senders with no identifying metadata are NOT trusted,
 * so the privileged extension-only routes can't be reached without provenance.
 */
export function isExtensionSender(sender: MsgSender): boolean {
  const senderUrls = [sender.origin, sender.url, sender.tab?.url]
  const extensionId = chrome.runtime?.id
  const isOwnExtensionUrl = (url: string | undefined) => {
    if (!url) return false
    if (!extensionId) return url.startsWith('chrome-extension://')

    return url.startsWith(`chrome-extension://${extensionId}/`)
  }

  return senderUrls.some(isOwnExtensionUrl)
}

/**
 * Identifies messages sent by a page tab, excluding extension UI tabs so
 * extension pages cannot exercise dApp-only routes.
 */
export function isDappSender(sender: MsgSender): boolean {
  return typeof sender.tab?.id === 'number' && !isExtensionSender(sender)
}
