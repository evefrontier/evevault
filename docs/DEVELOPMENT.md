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

The extension supports switching between Sui devnet, testnet, and mainnet. Implementation lives in `useNetworkStore` (`setChain`) and the shared `NetworkSelector`.

- **Network selector UI**: Use the network control in the shell (bottom-left in the extension) to pick a chain. The selector calls `setChain` and, when the switch needs a new login, runs the `onRequiresReauth` / `onNetworkSwitchStart` callbacks from the host app.
- **Primary OAuth JWT (network-agnostic)**: One **primary** OIDC token is stored and validated with `hasJwt()` / `getJwt()`. The OAuth redirect no longer depends on a client-bound nonce; that is handled when vending zkLogin.
- **Per-network zkLogin JWTs**: After login, **zkLogin** `id_token` entries are stored **per chain** (they are vended with a chain-specific nonce). See `storeZkLoginJwtForNetwork` / `getZkLoginJwtForNetwork` in `storageService`.
- **Per-network device data**: `deviceStore.networkData[chain]` holds nonce, maxEpoch, `jwtRandomness`, and related fields. Nonce can be regenerated when switching chains. On a seamless switch, missing or stale device data (including expired max-epoch window) triggers `initializeForChain` for the target chain.

**Network switching flow (summary):**

1. User selects a network → `setChain(targetChain)` runs.
2. **No valid primary JWT** → chain updates → auth re-init → optional `initializeForChain` → `requiresReauth: true`.
3. **Valid primary JWT** → chain updates → (extension) notify wallet listeners → refresh device data for the target chain if needed → `requiresReauth: false`. On error → revert chain.

**Testing network switching:**

- Seamless path: valid primary JWT; device data present or successfully refreshed for the target chain.
- Re-auth path: no valid primary JWT (expect `requiresReauth` and login / OAuth flow).
- Isolation: zkLogin JWTs and device slots differ per chain; primary OAuth is shared across chains until logout or expiry.

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
