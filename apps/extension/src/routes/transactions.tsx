import {
  HeaderMobile,
  TransactionsScreen,
  useAuthStore,
} from "@evevault/shared";
import { requireAuth } from "@evevault/shared/router";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { EXTENSION_ROUTES } from "@evevault/shared/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleNavigateBack = () => {
    navigate({ to: EXTENSION_ROUTES.HOME });
  };

  const handleTransactionsClick = () => {
    // Already on transactions page, no-op
  };

  if (!user || !chain) {
    return null;
  }

  return (
    <div className="flex flex-col gap-10">
      <HeaderMobile
        email={user?.profile?.email as string}
        address={user?.profile?.sui_address as string}
        onTransactionsClick={handleTransactionsClick}
      />
      <TransactionsScreen
        user={user}
        chain={chain}
        onBack={handleNavigateBack}
      />
    </div>
  );
}

export const Route = createFileRoute("/transactions")({
  beforeLoad: () => requireAuth(),
  component: TransactionsPage,
});
