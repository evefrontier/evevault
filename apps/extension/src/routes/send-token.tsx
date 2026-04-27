import {
  HeaderMobile,
  isLocalnetChain,
  SendTokenScreen,
  useAuthStore,
} from "@evevault/shared";
import type { SendTokenSearch } from "@evevault/shared/router";
import { useNetworkStore } from "@evevault/shared/stores";
import { EXTENSION_ROUTES } from "@evevault/shared/utils";
import { useActiveSuiAddress } from "@evevault/shared/wallet";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

function SendTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const activeAddress = useActiveSuiAddress();
  const { coinType } = useSearch({ from: "/send-token" });

  const handleNavigateBack = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex flex-col gap-10">
      <HeaderMobile
        email={user?.profile?.email as string}
        address={activeAddress ?? (user?.profile?.sui_address as string)}
        onTransactionsClick={() =>
          navigate({ to: EXTENSION_ROUTES.TRANSACTIONS })
        }
      />
      <SendTokenScreen coinType={coinType} onCancel={handleNavigateBack} />
    </div>
  );
}

export const Route = createFileRoute("/send-token")({
  beforeLoad: () => {
    const { user } = useAuthStore.getState();
    const { chain } = useNetworkStore.getState();
    if (!user && !isLocalnetChain(chain)) {
      throw redirect({ to: "/" });
    }
  },
  component: SendTokenPage,
  validateSearch: (search: Record<string, unknown>): SendTokenSearch => {
    const coinType = (search.coinType as string) || "";
    // Redirect to home if coinType is missing
    if (!coinType) {
      throw redirect({ to: "/" });
    }
    return { coinType };
  },
});
