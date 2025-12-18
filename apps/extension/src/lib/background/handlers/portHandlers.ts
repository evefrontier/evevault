import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

function handlePortConnection(port: chrome.runtime.Port) {
  log.info("Port connected", { name: port.name });

  // Listen for logout requests
  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.action === "logout") {
      port.postMessage({ action: "logout" });
    }
  });
}

export { handlePortConnection };
