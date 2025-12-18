import { LockScreen } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import { Background, Button, Heading, Text } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";

export const LoginScreen = () => {
  const { login, loading } = useAuth();

  const { isLocked, isPinSet, unlock } = useDevice();

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  return (
    <Background>
      <div className="app-shell">
        <header className="app-shell__header">
          <Heading level={1} variant="bold">
            EVE Vault
          </Heading>
        </header>
        <main className="app-shell__content">
          <div className="card">
            <Text>Web Application</Text>
            <Button onClick={() => login()} disabled={loading}>
              {loading ? "Loading..." : "Sign in"}
            </Button>
          </div>
        </main>
        <footer className="app-shell__footer" />
      </div>
    </Background>
  );
};
