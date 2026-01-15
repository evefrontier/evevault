import {
  AddTokenScreen,
  useAuthStore,
  useNetworkStore,
} from "@evevault/shared";
import { requireAuth } from "@evevault/shared/router";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: AddTokenPage,
});
