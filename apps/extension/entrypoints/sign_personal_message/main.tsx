import { Layout, ToastProvider } from "@evevault/shared/components";
import { queryClient } from "@evevault/shared/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import SignPersonalMessage from "../../src/features/wallet/components/SignPersonalMessage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Layout variant="extension" showNav={false}>
          <SignPersonalMessage />
        </Layout>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
