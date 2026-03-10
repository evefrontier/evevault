import {
  applyTenantFromUrl,
  getCurrentTenantId,
  getDefaultTenantId,
} from "@evevault/shared";
import { runTenantSwitchCleanup } from "@evevault/shared/auth";
import { useEffect, useRef } from "react";

/**
 * Syncs tenant from URL (?tenant=) on load. If the URL tenant differs from
 * stored, clears auth and redirects so the user can log in with the new server.
 * Only used with web app.
 */
export function TenantUrlSync() {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    void (async () => {
      const previous = getCurrentTenantId();
      const { tenantId: newTenantId, changed } = await applyTenantFromUrl();

      if (!changed) return;

      await runTenantSwitchCleanup(previous);
      const url =
        newTenantId === getDefaultTenantId()
          ? window.location.origin
          : `${window.location.origin}?tenant=${newTenantId}`;
      window.location.href = url;
    })();
  }, []);

  return null;
}
