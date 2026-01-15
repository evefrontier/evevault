import { HeaderMobile, SendTokenScreen, useAuthStore } from "@evevault/shared";
import type { SendTokenSearch } from "@evevault/shared/router";
import { requireAuth } from "@evevault/shared/router";
import { EXTENSION_ROUTES } from "@evevault/shared/utils";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

function SendTokenPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { coinType } = useSearch({ from: "/send-token" });

  const handleNavigateBack = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex flex-col gap-10">
      <HeaderMobile
        email={user?.profile?.email as string}
        address={user?.profile?.sui_address as string}
        onTransactionsClick={() =>
          navigate({ to: EXTENSION_ROUTES.TRANSACTIONS })
        }
      />
      <SendTokenScreen coinType={coinType} onCancel={handleNavigateBack} />
    </div>
  );
}

export const Route = createFileRoute("/send-token")({
  beforeLoad: () => requireAuth(),
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
