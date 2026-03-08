// Vite environment variables type declarations for the shared package
// This enables import.meta.env usage without requiring vite as a dependency

interface ImportMetaEnv {
  readonly VITE_ENOKI_API_KEY: string;
  readonly VITE_FUSIONAUTH_REDIRECT_URI: string;
  readonly VITE_TENANT_STILLNESS_CLIENT_SECRET: string;
  readonly VITE_TENANT_UTOPIA_CLIENT_SECRET: string;
  readonly VITE_TENANT_TESTEVENET_CLIENT_SECRET: string;
  readonly VITE_TENANT_NEBULA_CLIENT_SECRET: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
