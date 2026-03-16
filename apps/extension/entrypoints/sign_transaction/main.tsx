import { Layout, ToastProvider } from "@evevault/shared/components";
import { queryClient } from "@evevault/shared/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import SignTransaction from "../../src/features/wallet/components/SignTransaction";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Layout variant="extension" showNav={false}>
          <SignTransaction />
        </Layout>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
