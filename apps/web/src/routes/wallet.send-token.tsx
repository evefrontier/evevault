import { Button, Layout, SendTokenScreen } from "@evevault/shared";
import type { SendTokenSearch } from "@evevault/shared/router";
import { requireAuth } from "@evevault/shared/router";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

function SendTokenPage() {
  const navigate = useNavigate();
  const { coinType } = useSearch({ from: "/wallet/send-token" });

  const handleCancel = () => {
    navigate({ to: "/wallet" });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-10">
        <Button
          variant="secondary"
          size="small"
          onClick={handleCancel}
          className="self-start"
        >
          ← Back
        </Button>
        <SendTokenScreen coinType={coinType} onCancel={handleCancel} />
      </div>
    </Layout>
  );
}

export const Route = createFileRoute("/wallet/send-token")({
  beforeLoad: () => requireAuth({ preserveRedirectPath: true }),
  component: SendTokenPage,
  validateSearch: (search: Record<string, unknown>): SendTokenSearch => {
    const coinType = (search.coinType as string) || "";
    // Redirect to wallet if coinType is missing
    if (!coinType) {
      throw redirect({ to: "/wallet" });
    }
    return { coinType };
  },
});
