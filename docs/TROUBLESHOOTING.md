# Troubleshooting Guide

Common issues and solutions when working with the EVE Vault extension.

## Popup Issues

### Popup shows no address or balance

**Symptoms:**

- Popup opens but shows no address
- Balance is null or zero
- User appears logged in but data missing

**Solutions:**

1. Open the background console and review `auth_success` logs
2. Check that tokens are being stored correctly:
   ```javascript
   await chrome.storage.local.get(["evevault:jwt"]);
   ```
3. Verify `deviceStore` is initialized:
   ```javascript
   await chrome.storage.local.get(["evevault:device"]);
   ```
   Check for `maxEpoch`, `nonce`, `jwtRandomness` in storage
4. Ensure you're on the correct network (check SuiClient configuration)
5. Verify Enoki API key is valid and accessible
6. Check network tab for failed API calls

### Popup doesn't open

**Symptoms:**

- Clicking extension icon does nothing
- Popup window doesn't appear

**Solutions:**

1. Check if extension is enabled in `chrome://extensions`
2. Reload the extension
3. Check for errors in background console
4. Verify `popup.html` exists in `.output/chrome-mv3/`
5. Check manifest.json for popup configuration

## Authentication Issues

### OAuth flow fails

**Symptoms:**

- Redirect doesn't work
- "Authentication failed" error
- Stuck on OAuth provider page

**Solutions:**

1. Verify redirect URI matches provider settings:
   - Check `chrome.identity.getRedirectURL()` output in background console
   - Must match exactly in FusionAuth OAuth settings
2. Check environment variables are loaded:
   ```javascript
   import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
   ```
3. Verify OAuth client IDs are correct
4. Check OAuth provider logs for errors
5. Ensure scopes are enabled: `openid`, `profile`, `email`
6. Check if extension ID changed (requires updating redirect URI)

### Token exchange fails

**Symptoms:**

- OAuth completes but extension shows error
- "Token exchange failed" message

**Solutions:**

1. Check background console for detailed error
2. Verify client secret is correct
3. Check token exchange endpoint is accessible
4. Verify provider-specific configuration
5. Check network tab for failed requests

### User not persisting

**Symptoms:**

- User logged in but disappears on popup close
- Need to login again after browser restart

**Solutions:**

1. Check if UserManager storage is working
2. Verify OIDC storage isn't being cleared
3. Check `authStore` initialization
4. Verify storage permissions in manifest

## State Management Issues

### State not persisting

**Symptoms:**

- Data lost on popup close/reopen
- Store resets to initial state

**Solutions:**

1. Check if Zustand persist middleware is configured correctly
2. Verify `chromeStorageAdapter` is working:
   ```javascript
   await chrome.storage.local.get(null);
   ```
3. Look for initialization guards - multiple `initialize()` calls can overwrite data
4. Check for storage key conflicts between different stores
5. Verify storage permissions in manifest.json
6. Check browser storage quota (rare but possible)

### Store not updating

**Symptoms:**

- Changes to store don't reflect in UI
- React components not re-rendering

**Solutions:**

1. Verify components are using hooks (`useAuthStore`, `useDeviceStore`)
2. Check if store subscription is working
3. Verify store actions are being called
4. Check for TypeScript errors
5. Ensure store is properly exported

## Background Script Issues

### Background script can't access Zustand stores

**Symptoms:**

- Errors when accessing stores from background
- "Store not initialized" errors

**Solutions:**

1. Don't use Zustand stores directly in `background.ts`
2. Use direct `chrome.storage` APIs instead
3. Background service workers don't reliably hydrate Zustand persist middleware
4. Use `storeAccessor.ts` only for reading, not writing
5. Implement storage-first pattern: background writes to storage, popup reads from Zustand

### Messages not working

**Symptoms:**

- dApp can't communicate with extension
- Message handlers not responding

**Solutions:**

1. Check background console for errors
2. Verify message listeners are registered
3. Check message format matches expected structure
4. Verify content script is injected
5. Check for CORS or CSP issues

## ZK Proof Issues

### ZK Proof generation fails

**Symptoms:**

- "ZK proof generation failed" error
- Proof request returns error

**Solutions:**

1. Check console logs for the prepared payload to verify all parameters are present
2. Verify `maxEpoch`, `jwtRandomness`, `ephemeralKeyPair`, and tokens are all stored correctly
3. Ensure Enoki API is accessible and returning valid data
4. Check Sui prover endpoint is accessible
5. Verify network configuration (devnet/testnet/mainnet)
6. Check if maxEpoch has expired (requires re-login)

### MaxEpoch expired

**Symptoms:**

- "Epoch expired" error

**Solutions:**

1. This is expected behavior - maxEpoch has a validity window
2. User needs to re-login after epoch expires
3. Future: Implement automatic epoch refresh (TODO)

## Build Issues

### Build fails

**Symptoms:**

- `bun run build` errors
- TypeScript errors
- Missing dependencies

**Solutions:**

1. Run `bun install` to ensure dependencies are installed
2. Check TypeScript errors: `bun run typecheck`
3. Verify all workspace packages are linked
4. Check for circular dependencies
5. Clear node_modules and reinstall: `rm -rf node_modules && bun install`

### Output not found

**Symptoms:**

- Build succeeds but no output directory
- Can't find `.output/` folder

**Solutions:**

1. Extension: Check `apps/extension/.output/chrome-mv3/`
2. Web: Check `apps/web/dist/`
3. Verify build completed successfully
4. Check for build errors in console
5. Verify WXT/Vite configuration

## Network Issues

### Can't connect to Sui network

**Symptoms:**

- Balance doesn't load
- Transaction fails
- Network errors in console

**Solutions:**

1. Check network configuration in `packages/shared/src/sui/`
2. Verify RPC endpoints are accessible
3. Check if on correct network (devnet/testnet/mainnet)
4. Verify network switching works
5. Check for CORS issues

### Enoki API errors

**Symptoms:**

- Address derivation fails
- "Enoki API error" message

**Solutions:**

1. Verify `VITE_ENOKI_API_KEY` is set correctly
2. Check API key is valid and not expired
3. Verify Enoki API is accessible
4. Check rate limits
5. Review Enoki API documentation

## Development Issues

### Hot reload not working

**Symptoms:**

- Changes don't appear after save
- Need to manually reload extension

**Solutions:**

1. Check browser console for errors
2. Reload the extension manually
3. Clear browser cache
4. Restart dev server
5. Check WXT dev server is running

### Import errors

**Symptoms:**

- "Cannot find module" errors
- Workspace imports not resolving

**Solutions:**

1. Verify import path uses workspace name: `@evevault/shared/...`
2. Check `tsconfig.json` paths configuration
3. Verify package is in workspace
4. Run `bun install` to link packages
5. Check Vite/WXT alias configuration

## Getting More Help

If you're still experiencing issues:

1. Check [Development Guide](./DEVELOPMENT.md) for debugging tips
2. Review [Implementation Details](./IMPLEMENTATION.md) for architecture
3. Check browser console and background console for errors
4. Verify environment variables are set correctly
5. Check OAuth provider logs
6. Review [Monorepo README](./MONOREPO_README.md) for setup

## Related Documentation

- [Development Guide](./DEVELOPMENT.md) - Development workflow and debugging
- [Implementation Details](./IMPLEMENTATION.md) - Core implementation
- [Monorepo README](./MONOREPO_README.md) - Project structure
