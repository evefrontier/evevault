import { requireAuth } from "@evevault/shared/router";
import { createFileRoute } from "@tanstack/react-router";
import { WalletScreen } from "../../features/wallet/components/WalletScreen";

export const Route = createFileRoute("/wallet/")({
  beforeLoad: () => {
    document.title = "EVE Vault - Wallet";
    requireAuth({ preserveRedirectPath: true });
  },
  component: WalletScreen,
});
