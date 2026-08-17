/// <reference types="vite/client" />

/** Virtual module provided by wxt.config appVersionPlugin (version from extension package.json, commit from build env/git). */
declare module 'virtual:app-version' {
  export const APP_VERSION: string
  export const BUILD_COMMIT: string
}
