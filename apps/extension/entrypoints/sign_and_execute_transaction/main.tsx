import { Layout } from "@evevault/shared/components";
import React from "react";
import ReactDOM from "react-dom/client";
import SignAndExecuteTransaction from "../../src/features/wallet/components/SignExecuteTransaction";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Layout showNav={false}>
      <SignAndExecuteTransaction />
    </Layout>
  </React.StrictMode>,
);
