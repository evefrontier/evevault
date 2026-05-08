import {
  AddTokenScreen,
  HeaderMobile,
  useAuthStore,
  useContext,
} from "@evevault/shared";
import { requireAuth } from "@evevault/shared/router";
import { EXTENSION_ROUTES } from "@evevault/shared/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

function AddTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useContext();

  const handleNavigateBack = () => {
    navigate({ to: "/" });
  };

  // Note: Layout is provided by popup entrypoint, so we only render content here
  return (
    <div className="flex flex-col gap-10">
      <HeaderMobile
        email={user?.profile?.email as string}
        address={user?.profile?.sui_address as string}
        onTransactionsClick={() =>
          navigate({ to: EXTENSION_ROUTES.TRANSACTIONS })
        }
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
