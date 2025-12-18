# EVE Vault Monorepo Structure

This repository uses **Turborepo** with **Bun workspaces** for a scalable monorepo setup.

## Structure

```
eve-frontier-vault/
├── packages/
│   └── shared/              # Cross-platform business logic
│       ├── adapters/        # Platform-specific storage adapters (extension, web)
│       ├── hooks/           # React hooks (useDevice, useNetwork)
│       ├── stores/          # Zustand state stores
│       ├── screens/         # Shared screen components (e.g. Lockscreen)
│       ├── sui/             # Sui client, network configs
│       ├── auth/            # Enoki, token exchange
│       ├── types/           # TypeScript types
│       ├── utils/           # Crypto utilities, constants, auth cleanup
│       └── design/          # Design system (colors, spacing, typography, CSS)
│
└── apps/
    ├── extension/           # Browser extension (WXT)
    │   ├── entrypoints/     # WXT entry points (minimal)
    │   │   ├── background.ts
    │   │   ├── content.ts
    │   │   ├── injected.ts
    │   │   ├── callback.html
    │   │   ├── popup/       # Popup entry point
    │   │   │   ├── index.html
    │   │   │   ├── main.tsx
    │   │   │   └── style.css
    │   │   ├── sign_transaction/
    │   │   │   ├── index.html
    │   │   │   └── main.tsx
    │   │   ├── sign_personal_message/
    │   │   │   ├── index.html
    │   │   │   └── main.tsx
    │   │   └── sign_and_execute_transaction/
    │   │       ├── index.html
    │   │       └── main.tsx
    │   └── src/
    │       ├── lib/         # App-specific library code
    │       │   ├── adapters/ # Wallet Standard adapter
    │       │   │   └── SuiWallet.ts
    │       │   └── background/ # Background service worker code
    │       │       ├── handlers/ # Message/port handlers
    │       │       └── services/ # OAuth, storage services
    │       └── features/    # Feature-based organization
    │           ├── auth/    # Auth feature
    │           │   ├── api/
    │           │   ├── hooks/
    │           │   └── stores/
    │           └── wallet/ # Wallet feature
    │               ├── components/ # UI components (PopupApp, SignTransaction, etc.)
    │               ├── hooks/
    │               ├── stores/
    │               └── api/
    │
    └── web/                # Web application (Vite)
        └── src/
            ├── features/   # Feature-based organization
            └── shared/     # App-specific shared code
```

## Key Principles

1. **Entrypoints are minimal** - Only HTML and thin `main.tsx` files that import components from `src/`
2. **Components live in features** - All UI components are in `src/features/*/components/`
3. **Background code in lib** - Service worker handlers and services in `src/lib/background/`
4. **Adapters in lib** - Platform-specific adapters (like Wallet Standard) in `src/lib/adapters/`
5. **Kebab-case for folders** - All folder names use kebab-case to align with WXT/React/Vite conventions

## Dependency Management Strategy

### Shared Dependencies (Root `package.json`)

Common dependencies are hoisted to the root to:

- Reduce bundle size (single instance)
- Ensure version consistency
- Simplify dependency management

**Shared dependencies include:**

- `@mysten/sui` - Sui blockchain SDK
- `@mysten/wallet-standard` - Wallet standard
- `react` & `react-dom` - React framework
- `zustand` - State management

### App-Specific Dependencies

Each app only includes dependencies unique to that platform:

- **Extension**: `wxt`, `@wxt-dev/module-react`, `@types/chrome`, etc.
- **Web**: `vite`, `@vitejs/plugin-react`, etc.

### Package Dependencies

- **Shared packages** use `peerDependencies` for shared deps (hoisted from root)
- **Storage packages** only depend on workspace packages

## Getting Started

### Install Dependencies

```bash
bun install
```

This installs all dependencies (hoisted to root where possible), links workspace packages, and sets up Turborepo cache.

### Common Commands

```bash
# Development
bun run dev              # Run both extension and web app
bun run dev:extension    # Extension only (port 3000)
bun run dev:web          # Web app only (port 3001)

# Build
bun run build            # Build all packages and apps
bun run build:extension  # Extension only
bun run build:web        # Web app only

# Other
bun run typecheck        # Type check all packages
bun run clean            # Clean build outputs
```

Extension build output: `apps/extension/.output/chrome-mv3/` (or `firefox-mv3/` for Firefox)

## Task Orchestration

This project uses [Turborepo](https://turbo.build/) for task orchestration, caching, and parallel execution. Tasks are defined in `turbo.json` and run via `bun run <command>`.

For advanced usage and details on the Bun + Turborepo setup, see [Bun + Turborepo Setup Guide](./BUN_TURBO_SETUP.md).

## Importing Shared Packages

```typescript
// From shared packages
import { zkLoginSignature } from "@evevault/shared/wallet";
import { createSuiClient } from "@evevault/shared/sui";
import { getZkLoginAddress } from "@evevault/shared/auth";
import { buildTx, cleanupExtensionStorage } from "@evevault/shared/utils";
import { colors, spacing } from "@evevault/shared/design";

// From storage adapters
import { chromeStorageAdapter } from "@evevault/shared/adapters";
import { localStorageAdapter } from "@evevault/shared/adapters";
```

## Feature-Based Organization

Each app uses a feature-based structure:

- **features/auth/** - Authentication logic (api, hooks, stores)
- **features/wallet/** - Wallet operations (components, hooks, stores, api)
- **lib/** - App-specific library code (adapters, background services)

Within each feature:

- `components/` - React components
- `hooks/` - React hooks
- `stores/` - Zustand stores
- `api/` - API calls and configs

**📖 Need help deciding where to put a component?** See [Component Placement Guide](./COMPONENT_PLACEMENT_GUIDE.md)

## Extension Entrypoints Structure

The `entrypoints/` folder contains minimal entry files:

- **Entry files** (`background.ts`, `content.ts`, `injected.ts`) - Thin wrappers that import from `src/`
- **Popup entry** (`popup/main.tsx`) - Renders `PopupApp` from `src/features/wallet/components/`
- **Signing screens** (`sign-*/main.tsx`) - Render signing components from `src/features/wallet/components/`

All actual implementation lives in `src/`:

- Components in `src/features/*/components/`
- Background code in `src/lib/background/`
- Adapters in `src/lib/adapters/`

## Bundle Size Optimization

### How it works:

1. **Shared deps in root** - `react`, `@mysten/sui`, etc. are hoisted
2. **Workspace packages** - Only bundle workspace code, not deps
3. **Tree shaking** - Vite/Rollup removes unused code
4. **Peer dependencies** - Shared packages declare deps as peer (no duplication)

### Example:

- Extension needs `react` → Uses from root (no duplication)
- Web needs `react` → Uses from root (same instance)
- Both bundle their own code, but share runtime dependencies

## Development Setup

Both apps use Vite aliases (configured via `vite-tsconfig-paths`) to resolve workspace packages directly to source, enabling hot reloading of shared code without rebuilding packages.

For development workflow details, see the [Development Guide](./DEVELOPMENT.md).

## Naming Conventions

- **Folders**: kebab-case (`sign-transaction/`, `sign-personal-message/`)
- **Components**: PascalCase (`SignTransaction.tsx`, `PopupApp.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`)
- **Utils**: camelCase (`formatDate.ts`)
- **Stores**: camelCase with `Store` suffix (`authStore.ts`)

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).

## Related Documentation

- [Architecture Decision Record](./adr/001-hybrid-monorepo-structure.md) - Why we chose this structure
- [Bun + Turborepo Setup Guide](./BUN_TURBO_SETUP.md) - Deep dive on tooling choices
