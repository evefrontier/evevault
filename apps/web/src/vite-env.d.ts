/// <reference types="vite/client" />

/** Virtual module provided by vite.config appVersionPlugin (version from web package.json). */
declare module 'virtual:app-version' {
  export const APP_VERSION: string
}

interface ImportMetaEnv {
  /** Deployment tier the image is built for; limits the server list. */
  readonly VITE_TIER?: 'dev' | 'test' | 'uat' | 'ptu' | 'live'
}
