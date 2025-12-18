import {
  AddTokenScreen,
  HeaderMobile,
  useAuthStore,
  useNetworkStore,
} from "@evevault/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

function AddTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { chain } = useNetworkStore();

  const handleNavigateBack = () => {
    navigate({ to: "/" });
  };

  return (
    <>
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
    </>
  );
}

export const Route = createFileRoute("/add-token")({
  component: AddTokenPage,
});
