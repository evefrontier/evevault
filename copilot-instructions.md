# Code Review Guide for EVE Vault

This guide provides instructions for agents reviewing code changes in this repository. Focus on architectural patterns, error handling, testing, and code quality rather than linting issues (which are handled by Biome).

## Tech Stack

Use the **latest stable versions** of all dependencies. Check `package.json` for current versions.

| Technology | Notes |
|------------|-------|
| React | Uses React 19+ features (`use`, `useActionState`, `useOptimistic`) |
| TypeScript | Strict mode, `satisfies` operator, const type params |
| Zustand | With `persist` middleware, `useShallow` for selectors |
| TanStack Router | File-based type-safe routing |
| TanStack Query | Server state management |
| Biome | Linting and formatting (replaces ESLint/Prettier) |
| Vitest | Testing framework with React Testing Library |
| WXT | Browser extension framework |

## Table of Contents

- [Architecture Patterns](#architecture-patterns)
- [TypeScript Patterns](#typescript-patterns)
- [React 19 Patterns](#react-19-patterns)
- [Error Handling](#error-handling)
- [Testing Requirements](#testing-requirements)
- [State Management](#state-management)
- [Async Patterns](#async-patterns)
- [Component Patterns](#component-patterns)
- [Styling and Design System](#styling-and-design-system)
- [Security Considerations](#security-considerations)
- [Performance Considerations](#performance-considerations)
- [Documentation Requirements](#documentation-requirements)
- [Common Issues to Flag](#common-issues-to-flag)
- [What NOT to Review](#what-not-to-review)

## Architecture Patterns

### Project Structure

```
eve-frontier-vault-sui/
├── packages/              # Shared packages (cross-platform)
│   └── shared/            # Business logic, design system values, utilities
│       └── src/
│           ├── adapters/      # Storage adapters (Chrome, localStorage)
│           ├── auth/          # Authentication logic and stores
│           ├── components/    # Shared React components
│           ├── hooks/         # Shared React hooks
│           ├── services/      # Platform-agnostic services
│           ├── stores/        # Zustand stores
│           ├── sui/           # Sui blockchain utilities
│           ├── theme/         # Design system values
│           ├── types/         # Shared TypeScript types
│           └── utils/         # Utility functions
└── apps/                  # Platform-specific applications
    ├── extension/         # Browser extension (WXT)
    │   └── src/
    │       ├── features/      # Feature-based modules
    │       ├── lib/           # App-level utilities
    │       └── routes/        # TanStack Router routes
    └── web/               # Web application (Vite)
        └── src/
            ├── features/      # Feature-based modules
            ├── lib/           # App-level utilities
            └── routes/        # TanStack Router routes
```

### Feature-Based Structure (MVC Pattern)

Each feature should follow Model-View-Controller separation:

```
src/features/{feature-name}/
├── components/     # View: React components (presentation only)
├── hooks/          # Controller: Custom React hooks (coordination)
├── stores/         # Model: Zustand stores (state management)
└── api/            # Model: API calls and data fetching
```

**Review Checklist:**

- [ ] Does the code maintain proper MVC separation?
- [ ] Are Views (components) focused on presentation without business logic?
- [ ] Are Controllers (hooks) coordinating between Model and View?
- [ ] Is business logic in the Model layer (stores/api)?
- [ ] Are dependencies injected through hooks rather than direct imports?

### Import Rules

**Review Checklist:**

- [ ] Are workspace package imports used? (`@evevault/shared/*`)
- [ ] Are relative paths to packages avoided? (`../../packages/shared/`)
- [ ] Is the import order correct? (External → Workspace → App-level → Feature → Relative)
- [ ] For extension entrypoints: Are relative imports used instead of aliases?

### Dependency Injection

- [ ] Are stores accessed through hooks, not direct imports?
- [ ] Are services injected through React context or hooks?
- [ ] Are test utilities properly organized in `testing/` directories?

## TypeScript Patterns

### Type Safety Checklist

- [ ] Is `any` avoided? (If used, is it documented with a comment?)
- [ ] Is `unknown` used instead of `any` when type is truly unknown?
- [ ] Are type guards used for narrowing instead of type assertions?
- [ ] Are discriminated unions used for state machines?
- [ ] Is `satisfies` used for type checking without widening?
- [ ] Are strict null checks handled (no `!` without validation)?

**Example Patterns:**

```typescript
// ✅ Type guard instead of assertion
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value;
}

// ✅ Discriminated union for async state
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// ✅ satisfies for literal inference
const config = { theme: "dark", timeout: 5000 } satisfies AppConfig;

// ✅ Handle unknown errors
catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
}
```

## React 19 Patterns

### New React 19 Features Checklist

- [ ] Is `use()` hook considered for promise/context consumption?
- [ ] Are form actions using `useActionState` for server mutations?
- [ ] Is `useOptimistic` used for instant UI feedback?
- [ ] Are components using proper Suspense boundaries?

**Example Patterns:**

```typescript
// ✅ useActionState for forms
const [state, formAction, isPending] = useActionState(async (prev, formData) => {
  return await submitForm(formData);
}, null);

// ✅ useOptimistic for instant feedback
const [optimisticLikes, addOptimisticLike] = useOptimistic(likes, (curr, inc) => curr + inc);
```

## Error Handling

### Service Layer Error Handling

**Review Checklist:**

- [ ] Are errors properly typed (not `any` or generic `Error`)?
- [ ] Are error states included in stores (`error: string | null`)?
- [ ] Are errors logged using the logger before returning?
- [ ] Do error messages include context for debugging?
- [ ] Are try-catch blocks used for async operations?
- [ ] Is user feedback provided for errors (toasts, error states)?

**Example Pattern:**

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  log.error("Operation failed:", error);
  set({ error: error instanceof Error ? error.message : "Unknown error" });
  showToast("Operation failed. Please try again.");
}
```

### Store Error Handling

- [ ] Do stores have `error: string | null` state?
- [ ] Do stores have `loading: boolean` state?
- [ ] Are errors cleared on retry/success?
- [ ] Are errors properly typed in the store interface?

## Testing Requirements

### Unit Tests

**Review Checklist:**

- [ ] Are unit tests present for hooks and utility functions?
- [ ] Do tests cover both success and error paths?
- [ ] Are edge cases tested (null values, empty arrays, boundary conditions)?
- [ ] Are mocks only used for external boundaries (APIs, Chrome APIs)?
- [ ] Do tests avoid over-mocking internal modules?

**Example Pattern:**

```typescript
describe("useDevice", () => {
  it("should return maxEpoch for current chain", () => {
    // Test implementation
  });

  it("should return null when no device data exists", () => {
    // Test implementation
  });
});
```

### Integration Tests

**Review Checklist:**

- [ ] Do integration tests test real implementations, not mocks?
- [ ] Are external APIs mocked at the boundary (MSW for network)?
- [ ] Are browser APIs mocked only when unavailable in jsdom?
- [ ] Do tests clean up state after completion?

### Test Coverage

- [ ] Suggest additional test cases for error paths that aren't covered
- [ ] Suggest tests for edge cases (null values, empty strings, boundary conditions)
- [ ] Suggest tests for async operations and race conditions

## State Management

### Zustand Store Patterns

**Review Checklist:**

- [ ] Is there one store per feature domain?
- [ ] Do stores include initialization guards to prevent overwriting?
- [ ] Are stores persisted appropriately (Chrome storage for extension, localStorage for web)?
- [ ] Do stores use the `persist` middleware correctly?
- [ ] Are store actions async when needed?

**Example Pattern:**

```typescript
export const useFeatureStore = create<FeatureState>()(
  persist(
    (set, get) => ({
      data: null,
      loading: false,
      error: null,

      initialize: async () => {
        const existing = get().data;
        if (existing) return; // Don't overwrite

        set({ loading: true });
        try {
          const data = await fetchData();
          set({ data, loading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          });
        }
      },
    }),
    {
      name: "evevault:feature",
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter
      ),
    }
  )
);
```

### Zustand 5 Selectors

- [ ] Are selectors used to prevent unnecessary re-renders?
- [ ] Is `useShallow` used when selecting multiple values?
- [ ] Is entire store subscription avoided?

```typescript
// ✅ Individual selectors
const data = useStore((s) => s.data);

// ✅ Multiple values with useShallow
import { useShallow } from "zustand/shallow";
const { data, loading } = useStore(useShallow((s) => ({ data: s.data, loading: s.loading })));

// ❌ Entire store subscription
const store = useStore();
```

### Cross-Context State (Extension)

- [ ] Is Chrome storage used for background ↔ popup communication?
- [ ] Are stores rehydrated after background updates?
- [ ] Is `waitForDeviceHydration()` used before accessing store after login?

## Async Patterns

### Async/Await Checklist

- [ ] Are async operations properly awaited?
- [ ] Is `Promise.all` used for parallel independent operations?
- [ ] Are AbortControllers used for cancellable operations?
- [ ] Are cleanup functions in useEffect handling async properly?
- [ ] Are race conditions prevented?

**Example Patterns:**

```typescript
// ✅ Parallel operations
const [user, balance] = await Promise.all([fetchUser(id), fetchBalance(id)]);

// ✅ Cancellable fetch in useEffect
useEffect(() => {
  const controller = new AbortController();
  fetchData(url, { signal: controller.signal })
    .then(setData)
    .catch((e) => e.name !== "AbortError" && setError(e));
  return () => controller.abort();
}, [url]);

// ✅ Race condition prevention
const requestId = useRef(0);
useEffect(() => {
  const id = ++requestId.current;
  fetchData().then((data) => {
    if (id === requestId.current) setData(data);
  });
}, [dep]);
```
- [ ] Are reactive subscriptions used for UI updates?

## Component Patterns

### Component Structure

**Review Checklist:**

- [ ] Are components using named exports?
- [ ] Are props defined with explicit interfaces?
- [ ] Is logic extracted before the return statement?
- [ ] Are event handlers defined before return, not inline?
- [ ] Are complex calculations wrapped in `useMemo`?
- [ ] Is JSX clean and focused on composition?

**Example Pattern:**

```typescript
interface CardProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "outlined";
}

export function Card({ title, children, variant = "default" }: CardProps) {
  // Hooks first
  const { user } = useAuth();

  // Logic extracted before return
  const isAdmin = useMemo(() => user?.role === "admin", [user]);

  const handleClick = () => {
    // Event handler logic
  };

  // Clean JSX
  return (
    <div className={`card card--${variant}`}>
      {isAdmin && <Badge>Admin</Badge>}
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

### Layout Pattern

- [ ] Are pages using the `Layout` component from `@evevault/shared/components`?
- [ ] Is the app-shell structure NOT manually created?
- [ ] Are shared components used instead of raw HTML elements?

### File Size Limits

- [ ] Are files under 500 lines (preferred maximum)?
- [ ] Are files under 1000 lines (absolute maximum)?
- [ ] If over 500 lines, is the file split using MVC pattern?

## Styling and Design System

### Design System Values

**Review Checklist:**

- [ ] Are colors, spacing, and typography from the design system?
- [ ] Are hardcoded values avoided (`"#FFFFFF"`, `"16px"`)?
- [ ] Are Tailwind utility classes preferred over inline styles?
- [ ] Are shared CSS files used only when Tailwind cannot express the behavior?

**Example Pattern:**

```typescript
// ✅ CORRECT
import { colors, spacing } from "@evevault/shared/design";
<div style={{ padding: spacing.md, color: colors.text }}>

// ❌ WRONG
<div style={{ padding: "16px", color: "#FFFFD6" }}>
```

## Security Considerations

### Private Key Handling

- [ ] Are private keys NEVER logged or exposed in errors?
- [ ] Are sensitive buffers cleared after use?
- [ ] Are keys stored encrypted at rest?

```typescript
// ✅ Only log public key
log.debug("Keypair created", { publicKey: publicKey.toBase64() });

// ❌ NEVER log private key
log.debug("Keypair", { secretKey }); // SECURITY ISSUE
```

### Input Validation

- [ ] Are all user inputs validated?
- [ ] Are Sui addresses validated with `isValidSuiAddress`?
- [ ] Are validation errors displayed to users?
- [ ] Are amounts validated as positive numbers?

### JWT/Token Handling

- [ ] Are JWTs stored per-network to prevent cross-network usage?
- [ ] Are nonces validated before ZK proof generation?
- [ ] Is expiration checked before token use?
- [ ] Are tokens cleared on logout and session expiry?

```typescript
// ✅ Validate nonce before use
const decodedJwt = decodeJwt(jwt.id_token);
if (decodedJwt.nonce !== deviceNonce) {
  throw new Error("JWT nonce mismatch");
}
```

### Data Exposure

- [ ] Are error messages avoiding exposing sensitive information?
- [ ] Are internal implementation details hidden from error messages?
- [ ] Are private keys never logged or exposed?

## Performance Considerations

### React Performance

- [ ] Are expensive calculations wrapped in `useMemo`?
- [ ] Are callbacks wrapped in `useCallback` when passed to children?
- [ ] Are components memoized with `React.memo` when appropriate?
- [ ] Are effect dependencies minimal and correct?

### State Updates

- [ ] Are stores avoiding unnecessary re-renders?
- [ ] Are selectors used to subscribe to specific store slices?
- [ ] Are batch updates used when updating multiple state values?

### Network Performance

- [ ] Are API calls deduplicated?
- [ ] Is data cached appropriately?
- [ ] Are loading states shown during async operations?

## Documentation Requirements

### Code Comments

**Review Checklist:**

- [ ] Are comments explaining "why", not "what"?
- [ ] Are `any` type usages documented with reasons?
- [ ] Are complex algorithms or business logic explained?
- [ ] Are public APIs documented with JSDoc when non-obvious?
- [ ] Are self-explanatory functions left without comments?

**Example Pattern:**

```typescript
// ✅ GOOD - Comment explains non-obvious behavior
// Auto-lock after expiry to prevent stale sessions
if (this.unlockExpiry && Date.now() > this.unlockExpiry) {
  this.lock();
  return false;
}

// ❌ BAD - Comment restates the obvious
// Gets the public key
getPublicKey(): PublicKey | null {
  return this.signer?.getPublicKey() ?? null;
}
```

### Type Documentation

- [ ] Do exported interfaces have JSDoc comments when purpose is non-obvious?
- [ ] Are complex type parameters documented?
- [ ] Are error types documented in comments?

## Common Issues to Flag

### TypeScript Issues

- Using `any` without explanation
- Missing type annotations on function parameters/returns
- Using `as` type assertions instead of type guards
- Not handling `null`/`undefined` cases

### React Issues

- Logic inside JSX return statements
- Inline event handlers with complex logic
- Missing `key` props in lists
- Effects with incorrect dependencies
- Direct DOM manipulation instead of React state

### State Management Issues

- Business logic in components (should be in hooks/stores)
- Direct store mutation (should use actions)
- Not handling loading/error states
- Not persisting state that should survive refresh
- Subscribing to entire store instead of using selectors
- Not using `useShallow` for multiple value selections

### Async Issues

- Not handling Promise rejections
- Missing AbortController for cancellable operations
- Race conditions in useEffect
- Not awaiting async operations
- Swallowing errors silently

### Import Issues

- Relative paths to packages (`../../packages/shared/`)
- Wrong import order
- Circular dependencies
- Importing from internal paths instead of public exports

### Styling Issues

- Hardcoded colors, spacing, or typography values
- Raw HTML elements when shared components exist
- Manual app-shell structure instead of Layout component

### Error Handling Issues

- Swallowing errors silently
- Not logging errors before returning
- Generic error messages without context
- Not providing user feedback for errors

### Testing Issues

- Over-mocking internal modules
- Missing tests for error paths
- Tests not cleaning up state
- Mocking to work around broken dependencies

## What NOT to Review

Do not flag issues that are handled by Biome:

- Code formatting (indentation, quotes, semicolons)
- Import organization
- Unused imports/variables
- Trailing commas
- Line length

Focus on logic, architecture, error handling, testing, and security rather than style issues.

## Review Process

1. **Understand the Change**: Read the PR description and understand what the change accomplishes
2. **Check Architecture**: Verify the change follows MVC and feature-based patterns
3. **Review Error Handling**: Ensure errors are properly handled, typed, and logged
4. **Verify Tests**: Check that appropriate tests exist and cover the change
5. **Check State Management**: Verify stores follow best practices
6. **Security Review**: Look for security issues (input validation, data exposure)
7. **Performance Check**: Consider performance implications
8. **Documentation**: Verify documentation is updated if needed

## Example Review Comments

**Good Review Comment:**

> "This service method should use the logger instead of `console.error`. Also, consider adding an error state to handle failures gracefully in the UI."

**Bad Review Comment:**

> "You should use double quotes instead of single quotes." (This is handled by Biome)

**Good Review Comment:**

> "This component has business logic in the JSX return. Consider extracting it to a `useMemo` or moving it to a custom hook to maintain MVC separation."

**Bad Review Comment:**

> "This import should be sorted alphabetically." (This is handled by Biome)

## Adding New Features

1. Create feature folder structure:

   ```
   src/features/{feature}/
     components/     # View layer
     hooks/          # Controller layer
     stores/         # Model layer (if needed)
     api/            # Data fetching (if needed)
   ```

2. Define types in `types.ts` or use shared types from `@evevault/shared/types`

3. Implement store with loading/error states and persistence

4. Implement hooks to coordinate between store and components

5. Implement components using shared components and design system

6. Add tests for each layer

7. Export from feature `index.ts` if needed by other features

## Key Files to Reference

- `.cursorrules` - AI assistance rules and patterns
- `packages/shared/src/stores/` - Store patterns
- `packages/shared/src/hooks/` - Hook patterns
- `packages/shared/src/components/` - Component library
- `packages/shared/src/theme/` - Design system values
- `docs/DEVELOPMENT.md` - Development guide
- `docs/COMPONENT_PLACEMENT_GUIDE.md` - Where to place components

## Questions?

When in doubt:

1. Look at existing similar features in the codebase
2. Follow established patterns in `.cursorrules`
3. Check tests for usage examples
4. Check `packages/shared/` for reusable utilities

