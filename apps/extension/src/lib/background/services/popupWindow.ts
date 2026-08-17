import { createLogger } from '@evevault/shared/utils'
import { browser } from 'wxt/browser'

const log = createLogger()

/**
 * Opens an extension page (e.g. popup, sign_transaction) in a standalone popup window.
 * @param url - Page name without .html (e.g. "popup", "sign_transaction")
 * @returns The window id, or undefined if opening failed
 */
export async function openPopupWindow(
  url: string,
): Promise<number | undefined> {
  try {
    // WXT types runtime.getURL to statically-known public paths; the page name
    // is built dynamically here, so widen to the getURL parameter type.
    const popupUrl = browser.runtime.getURL(
      `/${url}.html` as Parameters<typeof browser.runtime.getURL>[0],
    )

    const window = await browser.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 500,
      height: 800,
      focused: true,
    })

    return window?.id
  } catch (error) {
    log.error('Failed to open popup', error)
    return undefined
  }
}
