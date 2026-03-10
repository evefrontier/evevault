import { useTenantStore } from "../stores/tenantStore";

export const useTenant = () => {
  const { tenantId, devMode, setTenantId, setDevMode } = useTenantStore();

  return {
    tenantId,
    devMode,
    setTenantId,
    setDevMode,
  };
};
