import { WalletActions } from "@evevault/shared";
import { Layout, ToastProvider } from "@evevault/shared/components";
import { queryClient } from "@evevault/shared/queryClient";
import { applyTheme } from "@evevault/shared/theme";
import { createLogger } from "@evevault/shared/utils";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import SignAndExecuteTransaction from "../../src/features/wallet/components/SignExecuteTransaction";
import SignPersonalMessage from "../../src/features/wallet/components/SignPersonalMessage";
import SignTransaction from "../../src/features/wallet/components/SignTransaction";
import { routeTree } from "../../src/routeTree.gen";
import "../style.css";

const log = createLogger();

// Apply default theme
applyTheme("dark");

// Create hash history for extension (required for chrome-extension:// URLs)
const hashHistory = createHashHistory();

// Create router instance with hash history
const router = createRouter({
  routeTree,
  history: hashHistory,
});

function getComponent() {
  const path = window.location.pathname;
  const htmlFile = path.split("/").pop() || "";
  const action = htmlFile.split(".")[0];

  switch (action) {
    case WalletActions.SIGN_PERSONAL_MESSAGE:
      return <SignPersonalMessage />;
    case WalletActions.SIGN_TRANSACTION:
      return <SignTransaction />;
    case WalletActions.SIGN_AND_EXECUTE_TRANSACTION:
      return <SignAndExecuteTransaction />;
    default:
      return <RouterProvider router={router} />;
  }
}

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Layout variant="extension" showNav={false}>
            {getComponent()}
          </Layout>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
} catch (error) {
  log.error("Failed to render popup entrypoint", error);
  rootElement.innerHTML = `
    <div style="padding: 20px;">
      <h1>EVE Vault</h1>
      <p style="color: red;">Failed to initialize: ${
        error instanceof Error ? error.message : String(error)
      }</p>
      <button onclick="window.location.reload()">Reload</button>
    </div>
  `;
}
