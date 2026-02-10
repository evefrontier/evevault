import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

/**
 * Opens an extension page (e.g. popup, sign_transaction) in a standalone popup window.
 * @param url - Page name without .html (e.g. "popup", "sign_transaction")
 * @returns The window id, or undefined if opening failed
 */
export async function openPopupWindow(
  url: string,
): Promise<number | undefined> {
  try {
    const popupUrl = chrome.runtime.getURL(`${url}.html`);

    const window = await chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 500,
      height: 500,
      focused: true,
    });

    return window.id;
  } catch (error) {
    log.error("Failed to open popup", error);
    return undefined;
  }
}
