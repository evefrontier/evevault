// Vite environment variables type declarations for the shared package
// This enables import.meta.env usage without requiring vite as a dependency

interface ImportMetaEnv {
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
