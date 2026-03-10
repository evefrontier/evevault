import {
  LockScreen,
  switchTenantAndReload,
  type TenantId,
} from "@evevault/shared";
import { redirectToFusionAuthLogout, useAuth } from "@evevault/shared/auth";
import { Button, Heading, TenantSelector } from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import { useDevice, useTenant } from "@evevault/shared/hooks";
import {
  getAvailableTenantIds,
  getCurrentTenantId,
} from "@evevault/shared/stores";
import { useMemo } from "react";

export const LoginScreen = () => {
  const { login, loading } = useAuth();
  const { isLocked, isPinSet, unlock } = useDevice();
  const { devMode, setDevMode } = useTenant();

  const availableTenantIds = useMemo(
    () => getAvailableTenantIds(devMode),
    [devMode],
  );
  const currentTenantId = getCurrentTenantId();

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
        <TenantSelector
          currentTenantId={currentTenantId as TenantId}
          availableTenantIds={availableTenantIds}
          onServerChange={(tenantId) =>
            switchTenantAndReload(tenantId as TenantId)
          }
        />
      </section>
      <Button
        variant="secondary"
        size="small"
        className="absolute! bottom-4 right-4"
        onClick={() => {
          setDevMode(!devMode);
        }}
      >
        <Icon name={devMode ? "Eye" : "HideEye"} color="#ED4136" size="small" />
      </Button>
    </div>
  );
};
