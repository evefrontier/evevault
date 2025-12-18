import { Layout } from "@evevault/shared/components";
import React from "react";
import ReactDOM from "react-dom/client";
import SignTransaction from "../../src/features/wallet/components/SignTransaction";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Layout showNav={false}>
      <SignTransaction />
    </Layout>
  </React.StrictMode>,
);
