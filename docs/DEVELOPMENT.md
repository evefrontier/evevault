# Development Guide

This guide covers development workflow, debugging, and tips for working with the EVE Vault extension.

## Development Workflow

### Starting Development

```bash
# Run extension only
bun run dev:extension

# Run web app only
bun run dev:web

# Run both (in parallel)
bun run dev
```

The extension dev server runs on port 3000, web app on port 3001.

### Hot Reload

WXT automatically reloads the extension on file changes in dev mode. You may need to refresh the extension in the browser if changes don't appear.

### Type Checking

```bash
bun run typecheck
```

## Debugging

### Background Console

Access the background service worker console:

1. Go to `chrome://extensions`
2. Find "EVE Vault" extension
3. Click "service worker" link
4. Console opens in DevTools

**Useful for:**

- OAuth flow debugging
- Message handling
- Storage operations
- Error logs

### Popup Console

Access the popup console:

1. Right-click the extension icon
2. Select "Inspect popup"
3. Console opens in DevTools

**Useful for:**

- React component debugging
- State management
- UI interactions

### Content Script Console

Content scripts run in page context. To debug:

1. Open DevTools on any webpage
2. Console shows content script logs
3. Look for messages prefixed with extension name

### Storage Inspection

Inspect Chrome storage from any console:

```javascript
// Get all storage
await chrome.storage.local.get(null);

// Get specific key
await chrome.storage.local.get(["evevault:device"]);

// Clear storage (use with caution!)
chrome.storage.local.clear();
```

## Development Tips

### Provider Testing

Test FusionAuth OAuth flow:

- Use different test accounts
- Verify redirect URIs are correct
- Check OAuth provider logs

### Initialization Guards

Always check for existing data before calling `initialize()`:

- Prevents overwriting existing keys
- Avoids unnecessary regeneration
- Maintains user state

### Storage Debugging

Subscribe to store changes to see when saves happen:

```typescript
import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

useDeviceStore.subscribe((state) => {
  log.debug("Device store updated", state);
});
```

### Network Switching

The extension supports seamless network switching between Sui devnet and testnet:

- **Network selector UI**: Click the network display in the bottom-left corner to switch networks
- **Per-network authentication**: Each network requires separate login (JWTs stored per-network)
- **Per-network device data**: Nonce, maxEpoch, and jwtRandomness are stored per-network to prevent conflicts
- **Automatic rollback**: If login fails after switching networks, the app automatically reverts to a network where you're still logged in
- **Seamless switching**: If you're already logged in on a network, switching is instant

**Network switching flow:**
1. User clicks network selector → checks if JWT exists for target network
2. If JWT exists → seamless switch (updates device data if needed)
3. If no JWT → shows "Sign In Required" dialog → user confirms → switches network → prompts login

**Testing network switching:**
- Test seamless switch (already logged in on both networks)
- Test switch requiring re-auth (only logged in on one network)
- Test login rollback on failure
- Verify per-network data isolation (no cross-network data leakage)

### Hot Reload Issues

If hot reload doesn't work:

1. Check browser console for errors
2. Reload the extension manually
3. Clear browser cache
4. Restart dev server

### Logging

**NEVER use `console.log`, `console.error`, `console.warn`, or `console.info`** in application code.

**ALWAYS use the logger from `@evevault/shared/utils/logger`**:

```typescript
import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

log.debug("Debug message", { data });
log.info("Info message");
log.warn("Warning message");
log.error("Error message", error);
```

See [Logger Guide](./LOGGER.md) for detailed logging information.

### Import Paths

Use workspace package imports:

```typescript
// ✅ Good
import { zkLoginSignature } from "@evevault/shared/wallet";

// ❌ Bad
import { zkLoginSignature } from "../../packages/shared/src/wallet";
```

### File Organization

Follow the feature-based structure:

- Components in `src/features/*/components/`
- Hooks in `src/features/*/hooks/`
- Stores in `src/features/*/stores/`
- API code in `src/features/*/api/`

### Entrypoints

Keep entrypoints minimal:

- Only HTML and thin `main.tsx` files
- Import components from `src/`
- Don't put logic in entrypoints
- **Use relative imports in entrypoints and extension feature code.** WXT loads entrypoint files in a Node context before Vite runs, so aliases such as `@/features/...` are not resolved. Because every feature is imported by an entrypoint, stick to relative paths (e.g. `../../auth/hooks/useAuth`) throughout `apps/extension/src/**`. Workspace package aliases like `@evevault/shared/*` remain valid.

## Common Development Tasks

### Adding a New Feature

1. Create feature folder: `src/features/new-feature/`
2. Add subfolders: `components/`, `hooks/`, `stores/`, `api/`
3. Follow naming conventions (see [Monorepo README](./MONOREPO_README.md#naming-conventions))
4. Import from shared packages when possible

### Adding a New Component

1. Create in appropriate feature: `src/features/*/components/`
2. Use PascalCase naming: `NewComponent.tsx`
3. Import hooks/stores from same feature
4. Use shared design tokens for styling

### Modifying Shared Code

1. Edit in `packages/shared/src/`
2. Changes automatically available to all apps
3. Hot reload works for shared code
4. Test in both extension and web app

### Debugging OAuth Flow

1. Check background console for OAuth logs
2. Verify redirect URI matches provider settings
3. Check `chrome.identity.getRedirectURL()` output
4. Verify environment variables are loaded
5. Check OAuth provider logs

### Seeding Web Auth from Extension

> **NOTE:** This is a temporary workaround until FusionAuth supports localhost callbacks.

**Prerequisites:**
- Extension installed and logged in
- Web app running: `bun run dev:web`

**Quick Method (Recommended):**

1. **Get and seed JWT in one step**

   Open extension background console (`chrome://extensions` → EVE Vault → click "service worker"):
   ```js
   const jwtData = await chrome.storage.local.get("evevault:jwt");
   ```

   Copy the result, then paste into web app console (`http://localhost:3001`):
   ```js
   window.seedEvevaultAuth(jwtData);
   ```

2. **Refresh and enter PIN**

   After seeing `[dev-auth] Seeded evevault:auth...`, refresh the page and enter your 6-digit PIN.

**Manual Method (Alternative):**

If you need more control or want to inspect the token data:

1. **Get token from extension**
   ```js
   await chrome.storage.local.get("evevault:jwt")
   ```
   This returns:
   ```js
   {
     "evevault:jwt": {
       "sui:devnet": {
         "access_token": "eyJ...",
         "id_token": "eyJ...",
         "token_type": "Bearer",
         "scope": "openid profile email",
         "expires_in": 3599
       }
     }
   }
   ```

2. **Extract and seed the token**
   ```js
   // Copy just the inner token object and seed:
   window.seedEvevaultAuth({
     "access_token": "eyJ...",
     "id_token": "eyJ...",
     "token_type": "Bearer",
     "scope": "openid profile email",
     "expires_in": 3599
   })
   ```

3. **Refresh and enter PIN**

**Clearing auth state:**

```js
localStorage.removeItem("evevault:auth");
localStorage.removeItem("evevault:jwt");
Object.keys(localStorage)
  .filter((key) => key.startsWith("evevault.oidc."))
  .forEach((key) => localStorage.removeItem(key));
// Also clear IndexedDB keypair if needed:
indexedDB.deleteDatabase("evevault-keys");
```

Re-run the seeding steps whenever the token expires.

### Testing State Management

1. Use React DevTools to inspect Zustand stores
2. Check Chrome storage for persisted state
3. Subscribe to store changes for debugging
4. Verify initialization guards work

## Best Practices

1. **Always use workspace imports** - Don't use relative paths to packages
2. **Keep entrypoints minimal** - Move logic to `src/`
3. **Follow feature structure** - Co-locate related code
4. **Use shared packages** - Don't duplicate business logic
5. **Test in both platforms** - Extension and web when possible
6. **Check storage** - Verify state persistence works
7. **Handle errors gracefully** - Provide user feedback
8. **Use TypeScript** - Leverage type safety

## Related Documentation

- [Monorepo README](./MONOREPO_README.md) - Structure and commands
- [Implementation Details](./IMPLEMENTATION.md) - Core implementation
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
