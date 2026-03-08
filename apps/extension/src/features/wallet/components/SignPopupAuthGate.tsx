import { Button, Heading, Text } from "@evevault/shared/components";
import { LockScreen } from "@evevault/shared/screens";
import type { User } from "oidc-client-ts";
import type { ReactNode } from "react";

export interface SignPopupAuthGateProps {
  isLocked: boolean;
  isPinSet: boolean;
  unlock: (pin: string) => Promise<void>;
  user: User | null;
  loading: boolean;
  login: () => Promise<User | undefined>;
  title: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  children: ReactNode;
}

/**
 * Renders lock screen when vault is locked, login prompt when unauthenticated,
 * or children when unlocked and authenticated.
 */
export function SignPopupAuthGate({
  isLocked,
  isPinSet,
  unlock,
  user,
  loading,
  login,
  title,
  onCancel,
  cancelDisabled = false,
  children,
}: SignPopupAuthGateProps) {
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 h-full">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20" />
        <Heading level={2}>{title}</Heading>
        <Text variant="light">You need to log in before signing.</Text>
        <Button
          onClick={() => login()}
          disabled={loading}
          variant="primary"
          size="fill"
        >
          {loading ? "Logging in..." : "Log In to Sign"}
        </Button>
        <Button
          onClick={onCancel}
          disabled={cancelDisabled}
          variant="secondary"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
