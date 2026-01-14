import { LockScreen } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import { Button, Heading } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";

export const LoginScreen = () => {
  const { login, loading } = useAuth();

  const { isLocked, isPinSet, unlock } = useDevice();

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <Heading level={1} variant="bold">
        EVE Vault
      </Heading>

      <Button size="large" onClick={() => login()} disabled={loading}>
        {loading ? "Loading..." : "Sign in"}
      </Button>
    </div>
  );
};
