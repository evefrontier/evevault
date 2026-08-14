import { type Browser, browser } from 'wxt/browser'

type MsgSender = Browser.runtime.MessageSender

/**
 * This extension's own origin (`chrome-extension://<id>` on Chrome,
 * `moz-extension://<uuid>` on Firefox), derived from `runtime.getURL` so the
 * scheme and host are whatever the current browser actually uses. Trailing
 * slash stripped so it matches both a bare origin and a full page URL.
 * Returns undefined outside an extension context (no `getURL`).
 */
function getOwnOrigin(): string | undefined {
  // WXT types getURL to statically-known public paths; widen to a plain string
  // signature since we only need the origin prefix.
  const getURL = browser.runtime?.getURL as
    | ((path: string) => string)
    | undefined
  const base = getURL?.('/')
  if (!base) return undefined
  return base.endsWith('/') ? base.slice(0, -1) : base
}

/**
 * Identifies messages from this extension rather than a web page. Fails closed:
 * trusted only when the sender URL is under this extension's own origin; no
 * metadata → rejected. When the own origin is unknown (no `getURL`), falls back
 * to any `chrome-extension://` / `moz-extension://` URL — a degraded path not
 * reached from the background, where routes are actually gated.
 */
export function isExtensionSender(sender: MsgSender): boolean {
  const ownOrigin = getOwnOrigin()
  const isOwnExtensionUrl = (url: string | undefined) => {
    if (!url) return false
    if (ownOrigin) {
      // Boundary match so a lookalike host (`…-evil`) can't prefix-escape.
      return url === ownOrigin || url.startsWith(`${ownOrigin}/`)
    }
    // No getURL (non-extension context): best-effort allow of extension schemes.
    return (
      url.startsWith('chrome-extension://') ||
      url.startsWith('moz-extension://')
    )
  }

  const senderUrls = [sender.origin, sender.url, sender.tab?.url]
  return senderUrls.some(isOwnExtensionUrl)
}

/**
 * Identifies messages sent by a page tab, excluding extension UI tabs so
 * extension pages cannot exercise dApp-only routes.
 */
export function isDappSender(sender: MsgSender): boolean {
  return typeof sender.tab?.id === 'number' && !isExtensionSender(sender)
}
