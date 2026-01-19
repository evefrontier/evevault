import { requireAuth } from "@evevault/shared/router";
import { createFileRoute } from "@tanstack/react-router";
import { WalletScreen } from "../features/wallet/components/WalletScreen";

export const Route = createFileRoute("/wallet")({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: WalletScreen,
  meta: () => [
    {
      title: "EVE Vault - Wallet",
    },
  ],
});
