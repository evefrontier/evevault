import { LockScreen } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import { Button, Heading, Text } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import { useNavigate } from "@tanstack/react-router";

export const LoginScreen = () => {
  const navigate = useNavigate();
  const { login, loginWithPopup, loading, error } = useAuth();
  const { isLocked, isPinSet, unlock } = useDevice();

  const handleLoginPopup = async () => {
    const user = await loginWithPopup();
    if (user) {
      navigate({ to: "/wallet" });
    }
  };

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>Sign in</Heading>
        </header>
        <div className="flex flex-col gap-4 w-full max-w-[300px]">
          <Button size="fill" onClick={() => login()} disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </Button>
          <Button
            size="fill"
            variant="secondary"
            onClick={handleLoginPopup}
            disabled={loading}
          >
            {loading ? "Loading..." : "Login (popup)"}
          </Button>
          {error ? (
            <Text color="error" size="small">
              {error}
            </Text>
          ) : null}
        </div>
      </section>
    </div>
  );
};
