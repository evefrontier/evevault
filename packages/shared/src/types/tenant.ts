import type { DEFAULT_TENANT_ID } from "../utils";

export type TenantId =
  | typeof DEFAULT_TENANT_ID
  | "utopia"
  | "stillness"
  | "testevenet"
  | "nebula";

export interface TenantConfig {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
  isDev?: boolean;
}

export interface TenantState {
  devMode: boolean;
  setDevMode: (value: boolean) => void;
  tenantId: TenantId;
  setTenantId: (id: TenantId) => Promise<void>;
}
