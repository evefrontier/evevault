import {
  AddTokenScreen,
  HeaderMobile,
  useAuthStore,
  useNetworkStore,
} from "@evevault/shared";
import { requireAuth } from "@evevault/shared/router";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

function AddTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleNavigateBack = () => {
    navigate({ to: "/" });
  };

  // Note: Layout is provided by popup entrypoint, so we only render content here
  return (
    <div className="flex flex-col gap-[40px]">
      <HeaderMobile
        email={user?.profile?.email as string}
        address={user?.profile?.sui_address as string}
      />
      <AddTokenScreen
        user={user}
        chain={chain || null}
        onSuccess={handleNavigateBack}
        onCancel={handleNavigateBack}
      />
    </div>
  );
}

export const Route = createFileRoute("/add-token")({
  beforeLoad: () => requireAuth(),
  component: AddTokenPage,
});
