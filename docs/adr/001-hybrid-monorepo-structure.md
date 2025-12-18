# ADR-001: Hybrid Monorepo Structure with Feature-Based Organization

|  Status  |    Date    | Drivers      |
| :------: | :--------: | :----------- |
| Accepted | 2025-11-10 | EVE NET Team |

## Context

The EVE Vault project needs to support multiple platforms:

- Browser extension (WXT + React)
- Web application (Vite + React)
- Future mobile app (React Native)

The current codebase started as a single browser extension. As we expand to support multiple platforms, we need:

1. Shared business logic across platforms (wallet operations, Sui interactions)
2. Platform-specific code isolation (extension APIs, web routing, mobile navigation)
3. Scalable code organization as features grow
4. Clear developer experience for finding and maintaining code

**Current challenges:**

- Wallet/Sui logic should be identical across platforms
- UI and storage mechanisms differ significantly between platforms (Chrome storage vs localStorage vs AsyncStorage)
- File-type organization (`components/`, `hooks/`, `stores/`) makes it hard to find related code
- Current structure doesn't scale well with new features

## Decision

We will adopt a **hybrid monorepo structure** that combines:

### 1. Monorepo-level shared packages (`packages/shared/`)

- Cross-platform business logic (wallet, Sui, crypto utilities)
- Design tokens (colors, spacing, typography)
- Types and interfaces
- Pure utility functions

### 2. Platform-specific storage adapters

- `packages/shared/src/adapters/extension` - Chrome storage adapter
- `packages/shared/src/adapters/wev` - localStorage storage adapter

### 3. Feature-based organization within each app

- Each app uses `features/` folders organized by domain (auth/, wallet/, transactions/)
- Each feature is self-contained with its own `components/`, `hooks/`, `stores/`, `api/`
- App-level `lib/` folder for platform-specific library code:
  - Platform adapters (e.g., Wallet Standard for extensions)
  - Platform services (e.g., background workers for extensions, routing for web)
- Entrypoints are minimal - only HTML and thin entry files that import from `src/`

**High-level structure:**

```
eve-frontier-vault/
├── packages/                # Shared packages
│   └── shared/              # Cross-platform business logic
│
└── apps/                    # Platform-specific applications
    ├── extension/           # Browser extension (WXT)
    │   ├── entrypoints/     # WXT entry points
    │   └── src/
    │       ├── lib/         # Extension-specific library code
    │       └── features/    # Feature-based organization
    │
    └── web/                 # Web application (Vite)
        └── src/
            ├── lib/         # Web-specific library code
            └── features/    # Feature-based organization
```

**Rationale:**

- **Monorepo with shared packages**: DRY principle, type safety, single source of truth, easier testing
- **Feature-based organization**: Co-location of related code, scalability, clear ownership, better developer experience
- **Hybrid approach**: Separation of concerns (shared packages handle cross-platform, feature folders handle app-specific), flexibility for each app to evolve independently

**Naming conventions:**

- Folders: kebab-case (`sign-transaction/`, `sign-personal-message/`)
- Components: PascalCase (`LoginForm.tsx`, `SignTransaction.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Utils: camelCase (`formatDate.ts`)
- Stores: camelCase with `Store` suffix (`authStore.ts`)
- Entrypoints: kebab-case to align with WXT/React/Vite conventions

**Package manager:** Bun workspaces for fast installs and script execution

## Consequences

### What becomes easier?

- **Finding related code**: Feature-based organization keeps related code together
- **Code reuse**: Business logic shared across platforms (no duplication)
- **Type safety**: Shared TypeScript types across all platforms
- **Testing**: Test shared logic once, works everywhere
- **Team collaboration**: Clear feature boundaries and ownership
- **Scaling**: New features don't clutter existing structure
- **Refactoring**: Changes to shared logic propagate automatically

### What will be more difficult?

- **Initial setup**: Monorepo tooling and workspace configuration
- **Import paths**: More indirection (imports from packages vs relative paths)
- **Build complexity**: Dependency ordering between packages
- **Discipline required**: Must maintain feature boundaries and avoid circular dependencies
- **Learning curve**: Developers need to understand both monorepo and feature-based structure

### Risks and Mitigations

- **Risk**: Shared packages become too large
  - _Mitigation_: Keep packages focused, split if needed
- **Risk**: Feature folders become too deep
  - _Mitigation_: Keep feature structure flat, avoid nesting
- **Risk**: Circular dependencies between packages
  - _Mitigation_: Clear dependency rules, tooling checks

## Alternatives

### Alternative 1: Separate repositories

**Approach:** Each platform (extension, web, mobile) in its own repository
**Pros:** Simpler per-repo, independent deployments, independent versioning
**Cons:** Code duplication, harder to share logic, version sync issues, no shared types
**Rejected:** Wallet logic must be shared; duplication would lead to bugs and inconsistencies

### Alternative 2: File-type organization everywhere

**Approach:** Keep current structure (`components/`, `hooks/`, `stores/`) for all apps
**Pros:** Simple, familiar structure
**Cons:** Hard to find related code, doesn't scale, all components in one folder
**Rejected:** Doesn't solve the scalability problem; related code is scattered

### Alternative 3: Pure feature-based (no shared packages)

**Approach:** Feature-based structure in each app, no shared packages
**Pros:** Simpler structure, no monorepo complexity
**Cons:** Code duplication across platforms, wallet logic copied 3+ times
**Rejected:** Wallet logic must be shared; duplication leads to maintenance issues

### Alternative 4: Shared packages only (no feature-based)

**Approach:** Monorepo with shared packages, but keep file-type organization in apps
**Pros:** Simpler app structure, shared logic
**Cons:** Apps still hard to navigate as they grow, related code scattered
**Rejected:** Doesn't solve app-level organization; feature-based structure needed for scalability
