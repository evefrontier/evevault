/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENOKI_API_KEY: string;
  readonly VITE_FUSIONAUTH_REDIRECT_URI: string;
  readonly VITE_TENANT_STILLNESS_CLIENT_SECRET: string;
  readonly VITE_TENANT_UTOPIA_CLIENT_SECRET: string;
  readonly VITE_TENANT_TESTEVENET_CLIENT_SECRET: string;
  readonly VITE_TENANT_NEBULA_CLIENT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
