declare global {
  // Shim for third-party packages (e.g. @evefrontier/dapp-kit) that reference
  // NodeJS.Timeout without shipping @types/node as a dependency.
  namespace NodeJS {
    type Timeout = ReturnType<typeof setTimeout>
  }
}

export {}
