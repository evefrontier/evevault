/**
 * Vite plugin that exposes a version string as the virtual module `virtual:app-version`.
 * Use when the version is read from package.json in the app's vite/wxt config so the app
 * can import APP_VERSION without using import.meta.env.
 *
 * Shared by apps/extension (wxt.config) and apps/web (vite.config).
 */
export function appVersionPlugin(appVersion: string) {
  return {
    name: "app-version",
    resolveId(id: string) {
      if (id === "virtual:app-version") return id;
    },
    load(id: string) {
      if (id === "virtual:app-version")
        return `export const APP_VERSION = ${JSON.stringify(appVersion)};`;
    },
  };
}
