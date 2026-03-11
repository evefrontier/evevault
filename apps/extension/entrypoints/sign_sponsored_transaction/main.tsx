import { Layout, ToastProvider } from "@evevault/shared/components";
import { queryClient } from "@evevault/shared/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import SignSponsoredTransaction from "../../src/features/wallet/components/SignSponsoredTransaction";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Layout variant="extension" showNav={false}>
          <SignSponsoredTransaction />
        </Layout>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
