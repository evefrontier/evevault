import {
  AddTokenForm,
  Layout,
  useAuthStore,
  useNetworkStore,
} from "@evevault/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "../lib/router/guards";

function AddTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleSuccess = () => {
    navigate({ to: "/wallet" });
  };

  return (
    <Layout
      header={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/wallet" })}
            className="text-[var(--neutral)] hover:text-[var(--quantum)]"
          >
            ← Back
          </button>
        </div>
      }
    >
      <AddTokenForm
        user={user}
        chain={chain || null}
        onSuccess={handleSuccess}
      />
    </Layout>
  );
}

export const Route = createFileRoute("/wallet/add-token")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AddTokenPage,
  meta: () => [
    {
      title: "EVE Vault - Add Token",
    },
  ],
});
