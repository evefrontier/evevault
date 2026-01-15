import {
  AddTokenScreen,
  useAuthStore,
  useNetworkStore,
} from "@evevault/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "../../lib/router/guards";

function AddTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleSuccess = () => {
    navigate({ to: "/wallet" });
  };

  return (
    <AddTokenScreen
      user={user}
      chain={chain || null}
      onSuccess={handleSuccess}
      onCancel={() => navigate({ to: "/wallet" })}
    />
  );
}

export const Route = createFileRoute("/wallet/add-token")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AddTokenPage,
});
