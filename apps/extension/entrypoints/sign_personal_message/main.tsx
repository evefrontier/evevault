import { Layout } from "@evevault/shared/components";
import React from "react";
import ReactDOM from "react-dom/client";
import SignPersonalMessage from "../../src/features/wallet/components/SignPersonalMessage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Layout showNav={false}>
      <SignPersonalMessage />
    </Layout>
  </React.StrictMode>,
);
