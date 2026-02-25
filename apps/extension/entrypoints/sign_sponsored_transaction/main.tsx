import { Layout } from "@evevault/shared/components";
import React from "react";
import ReactDOM from "react-dom/client";
import SignSponsoredTransaction from "../../src/features/wallet/components/SignSponsoredTransaction";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Layout showNav={false}>
      <SignSponsoredTransaction />
    </Layout>
  </React.StrictMode>,
);
