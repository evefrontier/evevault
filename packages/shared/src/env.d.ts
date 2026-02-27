// Vite environment variables type declarations for the shared package
// This enables import.meta.env usage without requiring vite as a dependency

interface ImportMetaEnv {
  readonly VITE_ENOKI_API_KEY: string;
  readonly VITE_FUSION_SERVER_URL: string;
  readonly VITE_FUSIONAUTH_CLIENT_ID: string;
  readonly VITE_FUSIONAUTH_API_KEY: string;
  readonly VITE_FUSION_CLIENT_SECRET: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
