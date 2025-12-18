/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FUSION_SERVER_URL: string;
  readonly VITE_FUSIONAUTH_CLIENT_ID: string;
  readonly VITE_FUSION_CLIENT_SECRET: string;
  readonly VITE_ENOKI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
