import {
  applyTenantFromUrl,
  getCurrentTenantId,
  runTenantSwitchCleanup,
} from "@evevault/shared/auth";
import { useEffect, useRef } from "react";

/**
 * Syncs tenant from URL (?tenant=) on load. If the URL tenant differs from
 * stored, clears auth and redirects so the user can log in with the new server.
 */
export function TenantUrlSync() {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const previous = getCurrentTenantId();
    const { tenantId: newTenantId, changed } = applyTenantFromUrl();

    if (!changed) return;

    runTenantSwitchCleanup(previous).then(() => {
      const url =
        newTenantId === "default"
          ? window.location.origin
          : `${window.location.origin}?tenant=${newTenantId}`;
      window.location.href = url;
    });
  }, []);

  return null;
}
