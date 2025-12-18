import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    log.info("Eve Vault content script loaded");

    const injectScript = document.createElement("script");
    injectScript.src = chrome.runtime.getURL("injected.js");

    (document.head || document.documentElement).appendChild(injectScript);

    // Remove the script element after it loads (optional cleanup)
    // injectScript.onload = () => injectScript.remove();

    // Listen for messages from the page
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      const data = event.data || {};
      if (data.__from === "Eve Vault") return;

      const shouldForward =
        typeof data.type === "string" || typeof data.action === "string";

      if (shouldForward) {
        chrome.runtime.sendMessage(data);
        return;
      }
    });

    // Listen for responses from background script and forward to page
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      const id = (message && (message.id as string)) || undefined;
      const type = (message && (message.type as string)) || "";

      // Forward all messages from background to page context
      // This includes chain change events, logout events, etc.
      window.postMessage({ __from: "Eve Vault", id, type, ...message }, "*");
    });
  },
});
