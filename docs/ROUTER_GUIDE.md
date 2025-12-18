# Router Guide - TanStack React Router

This guide explains how routing works in EVE Vault and how to add new routes and components for both the web app and browser extension.

## Table of Contents

1. [Overview](#overview)
2. [Router Structure](#router-structure)
3. [File-Based Routing](#file-based-routing)
4. [Adding New Routes](#adding-new-routes)
5. [Adding New Components](#adding-new-components)
6. [Route Guards & Authentication](#route-guards--authentication)
7. [Route Meta & Document Titles](#route-meta--document-titles)
8. [Error Handling](#error-handling)
9. [Navigation](#navigation)
10. [Best Practices](#best-practices)
11. [Examples](#examples)

## Overview

EVE Vault uses [TanStack React Router](https://tanstack.com/router) for type-safe, file-based routing. The router is configured differently for web and extension apps:

- **Web App**: Uses standard browser history
- **Extension**: Uses hash history (required for `chrome-extension://` URLs)

Both apps use the same file-based routing pattern, but have different route structures based on their use cases.

## Router Structure

### Web App Structure

```
apps/web/src/
├── routes/
│   ├── __root.tsx          # Root route with providers and error boundaries
│   ├── index.tsx           # Home/login route (/)
│   ├── callback.tsx         # OAuth callback route (/callback)
│   ├── wallet.tsx          # Wallet screen (/wallet)
│   └── not-found.tsx       # 404 handler
├── lib/router/
│   ├── guards.ts           # Authentication guards
│   ├── routeContext.tsx    # Route context provider
│   └── errorBoundary.tsx   # Error boundary component
└── routeTree.gen.ts        # Auto-generated route tree (DO NOT EDIT)
```

### Extension Structure

```
apps/extension/src/
├── routes/
│   ├── __root.tsx          # Root route
│   └── index.tsx           # Popup main route (/)
└── routeTree.gen.ts        # Auto-generated route tree (DO NOT EDIT)
```

**Key Differences:**

- **Web**: Multiple routes for different pages (login, wallet, callback, etc.)
- **Extension**: Simpler structure, primarily popup-based UI
- **Extension**: Uses hash history (`createHashHistory()`)
- **Web**: Uses standard history (default)

### Extension Secure Routes (Entrypoints, Not Router Routes)

**Important**: Secure signing actions (`SignPersonalMessage`, `SignTransaction`, `SignAndExecuteTransaction`) are **NOT** router routes. They are separate WXT entrypoints opened as standalone popup windows.

```
apps/extension/entrypoints/
├── popup/                  # Main popup (uses router)
│   ├── index.html
│   └── main.tsx           # Router setup
├── sign_personal_message/ # Standalone entrypoint (NO router)
│   ├── index.html
│   └── main.tsx           # Direct component render
├── sign_transaction/      # Standalone entrypoint (NO router)
│   ├── index.html
│   └── main.tsx           # Direct component render
└── sign_and_execute_transaction/ # Standalone entrypoint (NO router)
    ├── index.html
    └── main.tsx           # Direct component render
```

**Why Entrypoints Instead of Routes?**

1. **Security Isolation**: Each signing action opens in its own isolated popup window
2. **No Navigation Needed**: These windows don't navigate - they're single-purpose approval screens
3. **Simpler Architecture**: No need for router features (guards, navigation, etc.)
4. **Background Script Control**: Background script opens these via `chrome.windows.create()` with specific URLs

**How It Works:**

1. Background script receives signing request (e.g., `sign_personal_message`)
2. Calls `openPopupWindow(action)` which opens `chrome-extension://.../sign-personal-message.html`
3. Entrypoint directly renders the signing component (no router)
4. Component reads pending action from `chrome.storage.local`
5. User approves/rejects, result stored back to storage
6. Background script picks up result and responds to dapp

**Do NOT create router routes for these** - they must remain as separate entrypoints for security and isolation.

## File-Based Routing

TanStack Router uses file-based routing where the file structure determines the route structure.

### Route File Naming

| File Name     | Route Path | Example                       |
| ------------- | ---------- | ----------------------------- |
| `index.tsx`   | `/`        | Root/home route               |
| `wallet.tsx`  | `/wallet`  | `/wallet`                     |
| `$action.tsx` | `/$action` | `/sign-transaction` (dynamic) |
| `__root.tsx`  | N/A        | Root route wrapper            |

### Route File Structure

Every route file must export a `Route` constant:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { MyComponent } from "../features/my-feature/components/MyComponent";

export const Route = createFileRoute("/my-route")({
  component: MyComponent,
});
```

## Adding New Routes

### When to Use Routes vs Entrypoints (Extension Only)

**Use Router Routes For:**

- Main popup UI (`/` route)
- Settings screens
- Any UI that needs navigation within the same window
- Features that benefit from router features (guards, navigation, etc.)

**Use Entrypoints For (Extension Only):**

- Secure signing actions (`sign-personal-message`, `sign-transaction`, etc.)
- Any isolated popup window that doesn't need navigation
- Single-purpose approval/confirmation screens
- Security-critical flows that should be isolated

**Web App:**

- Always use router routes (no entrypoints concept)

### Step 1: Create Route File

Create a new file in `apps/{web|extension}/src/routes/`:

**Example: Adding a `/settings` route**

```typescript
// apps/web/src/routes/settings.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "../features/settings/components/SettingsScreen";
import { requireAuth } from "../lib/router/guards";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    await requireAuth(); // Protect route
  },
  component: SettingsScreen,
  meta: () => [
    {
      title: "EVE Vault - Settings",
    },
  ],
});
```

### Step 2: Create Component

Create the component in the appropriate feature directory:

```typescript
// apps/web/src/features/settings/components/SettingsScreen.tsx
import { Heading, Text, Background } from "@evevault/shared/components";

export const SettingsScreen = () => {
  return (
    <Background>
      <div className="app-shell">
        <main className="app-shell__content">
          <div className="card">
            <Heading level={1} variant="bold">
              Settings
            </Heading>
            <Text>Configure your preferences here.</Text>
          </div>
        </main>
      </div>
    </Background>
  );
};
```

### Step 3: Route Tree Auto-Generation

The route tree is automatically generated by TanStack Router plugin. After creating your route file:

1. **Development**: Route tree updates automatically on file save
2. **Build**: Route tree is generated during build process

**Important**: Never manually edit `routeTree.gen.ts` - it's auto-generated!

### Dynamic Routes

For dynamic routes (e.g., `/user/:id`), use `$` prefix:

```typescript
// apps/web/src/routes/user.$id.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/user/$id")({
  component: () => {
    const { id } = Route.useParams();
    return <div>User ID: {id}</div>;
  },
});
```

**Access params:**

```typescript
const { id } = Route.useParams();
```

**Access search params:**

```typescript
const search = useSearch({ from: "/user/$id" });
```

## Adding New Components

### Component Placement Decision Tree

```
Is the component route-specific?
├─ YES → Put it in: apps/{web|extension}/src/features/{feature}/components/
└─ NO → Is it reusable across features?
    ├─ YES → Put it in: apps/{web|extension}/src/lib/components/
    └─ NO → Is it reusable across platforms?
        └─ YES → Consider: packages/shared/src/components/
```

### Route-Specific Components

Route components should be placed in feature directories:

```
apps/web/src/features/
└── settings/
    └── components/
        └── SettingsScreen.tsx  # Route component
```

### Shared Components

Components used across multiple routes go in `lib/components/`:

```
apps/web/src/lib/components/
└── Layout.tsx  # Shared layout component
```

### Component Structure

Follow MVC pattern - extract logic to hooks:

```typescript
// ✅ CORRECT - Logic extracted to hook
// apps/web/src/features/settings/components/SettingsScreen.tsx
import { useSettings } from "../hooks/useSettings";
import { Heading, Text, Background } from "@evevault/shared/components";

export const SettingsScreen = () => {
  const { settings, loading, updateSetting } = useSettings();

  // Extract event handlers
  const handleToggle = (key: string) => {
    updateSetting(key, !settings[key]);
  };

  return (
    <Background>
      <div className="app-shell">
        <main className="app-shell__content">
          <div className="card">
            <Heading level={1} variant="bold">
              Settings
            </Heading>
            {/* Component UI */}
          </div>
        </main>
      </div>
    </Background>
  );
};
```

## Route Guards & Authentication

### Using Authentication Guards

Protect routes that require authentication:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "../lib/router/guards";

export const Route = createFileRoute("/protected")({
  beforeLoad: async () => {
    await requireAuth(); // Redirects to login if not authenticated
  },
  component: ProtectedComponent,
});
```

### How Guards Work

1. **`requireAuth()`** checks if user is authenticated
2. If not authenticated, redirects to `/` with `redirect` search param
3. After login, user is redirected back to original destination
4. Redirect path is stored in `sessionStorage` to persist through OAuth flow

### Custom Guards

Create custom guards in `apps/{web|extension}/src/lib/router/guards.ts`:

```typescript
import { redirect } from "@tanstack/react-router";

export async function requireAdmin() {
  const user = useAuthStore.getState().user;

  if (!user || user.profile?.role !== "admin") {
    throw redirect({ to: "/" });
  }

  return { user };
}
```

## Route Meta & Document Titles

### Adding Route Meta

Add meta information (like document titles) to routes:

```typescript
export const Route = createFileRoute("/my-route")({
  component: MyComponent,
  meta: () => [
    {
      title: "EVE Vault - My Page",
    },
  ],
});
```

### Document Title Hook

The `useDocumentTitle()` hook is available from `@evevault/shared/router` and automatically updates `document.title` based on route meta. Use it in your root route component:

```typescript
import { useDocumentTitle } from "@evevault/shared/router";

export const Route = createRootRoute({
  component: () => {
    useDocumentTitle(); // Automatically updates document.title based on route meta
    return <Outlet />;
  },
});
```

**Note**: This hook is shared between web and extension apps, so both automatically get document title updates when routes define meta titles.

### Dynamic Meta

Use route params for dynamic meta:

```typescript
export const Route = createFileRoute("/user/$id")({
  meta: ({ params }) => [
    {
      title: `EVE Vault - User ${params.id}`,
    },
  ],
});
```

## Error Handling

### Route-Level Error Boundaries

The root route includes an error boundary that catches route errors:

```typescript
// apps/web/src/routes/__root.tsx
export const Route = createRootRoute({
  errorComponent: RouteErrorBoundary,
  // ...
});
```

### 404 Handling

Add a `not-found.tsx` route and reference it in root:

```typescript
// apps/web/src/routes/not-found.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
  component: NotFoundScreen,
});

function NotFoundScreen() {
  return <div>404 - Page Not Found</div>;
}
```

```typescript
// apps/web/src/routes/__root.tsx
import { NotFoundScreen } from "./not-found";

export const Route = createRootRoute({
  notFoundComponent: NotFoundScreen,
  // ...
});
```

### Throwing 404

In route guards or loaders:

```typescript
import { notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/$id")({
  beforeLoad: async ({ params }) => {
    if (!isValidId(params.id)) {
      throw notFound();
    }
  },
});
```

## Navigation

### Using Navigation Hook

```typescript
import { useNavigate } from "@tanstack/react-router";

function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate({ to: "/wallet" });
  };

  return <button onClick={handleClick}>Go to Wallet</button>;
}
```

### Type-Safe Navigation

TanStack Router provides type-safe navigation:

```typescript
// ✅ Type-safe - autocompletes available routes
navigate({ to: "/wallet" });

// ✅ Type-safe with params
navigate({ to: "/user/$id", params: { id: "123" } });

// ✅ Type-safe with search params
navigate({
  to: "/callback",
  search: { code: "abc123" },
});
```

### Link Component

Use `Link` component for declarative navigation:

```typescript
import { Link } from "@tanstack/react-router";

<Link to="/wallet">Go to Wallet</Link>;
```

## Best Practices

### 1. Follow MVC Pattern

**❌ DON'T** - Logic in route component:

```typescript
export const Route = createFileRoute("/my-route")({
  component: () => {
    const data = complexCalculation(); // BAD - logic in component
    return <div>{data}</div>;
  },
});
```

**✅ DO** - Extract logic to hooks:

```typescript
// Hook
export function useMyData() {
  return useMemo(() => complexCalculation(), []);
}

// Route
export const Route = createFileRoute("/my-route")({
  component: () => {
    const data = useMyData(); // GOOD - logic extracted
    return <div>{data}</div>;
  },
});
```

### 2. Protect Routes Properly

Always use `beforeLoad` for authentication checks:

```typescript
export const Route = createFileRoute("/protected")({
  beforeLoad: async () => {
    await requireAuth(); // Check before component loads
  },
  component: ProtectedComponent,
});
```

### 3. Validate Search Params

Use Zod schemas for search param validation:

```typescript
import { z } from "zod";

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/callback")({
  validateSearch: searchSchema,
  component: CallbackScreen,
});
```

### 4. Use Route Meta

Always add meta titles for better UX:

```typescript
export const Route = createFileRoute("/my-route")({
  component: MyComponent,
  meta: () => [{ title: "EVE Vault - My Page" }],
});
```

### 5. Keep Route Files Simple

Route files should only configure routing, not contain business logic:

```typescript
// ✅ GOOD - Route file is simple
export const Route = createFileRoute("/wallet")({
  beforeLoad: async () => await requireAuth(),
  component: WalletScreen,
  meta: () => [{ title: "EVE Vault - Wallet" }],
});
```

### 6. Extract Complex Route Logic

For complex route logic (like dynamic component selection), use hooks:

```typescript
// ✅ GOOD - Logic extracted to hook
// apps/web/src/features/wallet/hooks/useWalletAction.ts
export function useWalletAction(action: string) {
  switch (action) {
    case WalletActions.SIGN_TRANSACTION:
      return SignTransaction;
    // ...
  }
}

// Route uses hook
export const Route = createFileRoute("/$action")({
  component: () => {
    const { action } = Route.useParams();
    const ActionComponent = useWalletAction(action);
    return <ActionComponent />;
  },
});
```

## Examples

### Example 1: Simple Protected Route

```typescript
// apps/web/src/routes/profile.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "../features/profile/components/ProfileScreen";
import { requireAuth } from "../lib/router/guards";

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: ProfileScreen,
  meta: () => [
    {
      title: "EVE Vault - Profile",
    },
  ],
});
```

### Example 2: Dynamic Route with Validation

```typescript
// apps/web/src/routes/transaction.$id.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { TransactionScreen } from "../features/transactions/components/TransactionScreen";
import { requireAuth } from "../lib/router/guards";
import { z } from "zod";

const searchSchema = z.object({
  view: z.enum(["details", "history"]).optional(),
});

export const Route = createFileRoute("/transaction/$id")({
  beforeLoad: async ({ params }) => {
    await requireAuth();

    // Validate transaction ID format
    if (!isValidTransactionId(params.id)) {
      throw notFound();
    }
  },
  validateSearch: searchSchema,
  component: TransactionScreen,
  meta: ({ params }) => [
    {
      title: `EVE Vault - Transaction ${params.id}`,
    },
  ],
});
```

### Example 3: Route with Loader (Advanced)

**Note**: Loaders are optional and can be used for data fetching. Currently, we prefer fetching data in components using hooks.

```typescript
// apps/web/src/routes/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "../features/dashboard/components/DashboardScreen";
import { requireAuth } from "../lib/router/guards";
import { fetchDashboardData } from "../features/dashboard/api/dashboardApi";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    await requireAuth();
  },
  // Optional: Use loader for data fetching
  loader: async () => {
    const data = await fetchDashboardData();
    return { data };
  },
  component: DashboardScreen,
  meta: () => [
    {
      title: "EVE Vault - Dashboard",
    },
  ],
});
```

**Alternative (Recommended)**: Fetch data in component using hooks:

```typescript
// Component fetches data using hook
export const DashboardScreen = () => {
  const { data, loading } = useDashboardData(); // Custom hook
  // ...
};
```

### Example 4: Extension Route

```typescript
// apps/extension/src/routes/settings.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "../features/settings/components/SettingsScreen";

export const Route = createFileRoute("/settings")({
  component: SettingsScreen,
});
```

**Note**: Extension routes typically don't need authentication guards since the popup is already authenticated.

### Example 5: Extension Secure Entrypoint (Not a Route)

**Important**: Secure signing actions use entrypoints, not router routes.

```typescript
// apps/extension/entrypoints/sign-personal-message/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import SignPersonalMessage from "../../src/features/wallet/components/SignPersonalMessage.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SignPersonalMessage />
  </React.StrictMode>
);
```

```html
<!-- apps/extension/entrypoints/sign-personal-message/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>EVE Vault - Sign Message</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**Key Points:**

- Entrypoint directly renders component (no router)
- Component reads pending action from `chrome.storage.local`
- Background script opens this via `openPopupWindow('sign-personal-message')`
- Result stored back to storage for background script to pick up

## Common Patterns

### Redirect After Login

The authentication flow automatically handles redirects:

1. User tries to access `/wallet` without auth
2. Guard redirects to `/` with `redirect=/wallet` search param
3. User logs in
4. Callback screen reads redirect from `sessionStorage`
5. User is redirected to `/wallet`

### Conditional Rendering Based on Auth

```typescript
import { useAuth } from "../features/auth/hooks/useAuth";

function MyComponent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <ProtectedContent />;
}
```

### Route Context Access

Access route context in components:

```typescript
import { useRouteContext } from "../lib/router/routeContext";

function MyComponent() {
  const { isAuthenticated, isLoading } = useRouteContext();
  // ...
}
```

## Troubleshooting

### Route Not Found

1. Check file name matches route path
2. Ensure route file exports `Route` constant
3. Check `routeTree.gen.ts` includes your route
4. Restart dev server if route tree doesn't update

### Type Errors in Navigation

1. Ensure route is in `routeTree.gen.ts`
2. Check route path matches exactly
3. Verify search params match schema

### Authentication Redirect Loop

1. Check `requireAuth()` guard implementation
2. Verify auth store is initialized
3. Check redirect path in `sessionStorage`

## Additional Resources

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [File-Based Routing Guide](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)
- [Route Guards Guide](https://tanstack.com/router/latest/docs/framework/react/guide/route-guards)
- [Component Placement Guide](./COMPONENT_PLACEMENT_GUIDE.md)
- [Development Guide](./DEVELOPMENT.md)
