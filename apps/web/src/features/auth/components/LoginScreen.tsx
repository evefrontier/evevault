import { LockScreen } from "@evevault/shared";
import { redirectToFusionAuthLogout, useAuth } from "@evevault/shared/auth";
import { Button, Heading, Text } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";

export const LoginScreen = () => {
  const { login, loading } = useAuth();

  const { isLocked, isPinSet, unlock } = useDevice();

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        onResetComplete={() => redirectToFusionAuthLogout()}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>Sign in</Heading>
        </header>
        <div className="w-full max-w-[300px]">
          <Button size="fill" onClick={() => login()} disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </Button>
        </div>
      </section>
    </div>
  );
};
