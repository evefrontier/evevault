import { createFileRoute } from "@tanstack/react-router";
import { WalletScreen } from "../features/wallet/components/WalletScreen";
import { requireAuth } from "../lib/router/guards";

export const Route = createFileRoute("/wallet")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: WalletScreen,
  meta: () => [
    {
      title: "EVE Vault - Wallet",
    },
  ],
});
