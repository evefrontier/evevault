import {
  Button,
  Layout,
  TransactionsScreen,
  useAuthStore,
} from "@evevault/shared";
import { requireAuth } from "@evevault/shared/router";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleBack = () => {
    navigate({ to: "/wallet" });
  };

  if (!user || !chain) {
    return null;
  }

  return (
    <Layout>
      <div className="flex flex-col gap-10">
        <Button
          variant="secondary"
          size="small"
          onClick={handleBack}
          className="self-start"
        >
          ← Back
        </Button>
        <TransactionsScreen user={user} chain={chain} onBack={handleBack} />
      </div>
    </Layout>
  );
}

export const Route = createFileRoute("/wallet/transactions")({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: TransactionsPage,
});
