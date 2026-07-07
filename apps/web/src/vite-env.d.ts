/// <reference types="vite/client" />

/** Virtual module provided by vite.config appVersionPlugin (version from web package.json). */
declare module 'virtual:app-version' {
  export const APP_VERSION: string
}

interface ImportMetaEnv {
  readonly VITE_FUSIONAUTH_REDIRECT_URI: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
