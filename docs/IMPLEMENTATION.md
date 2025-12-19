# Implementation Details

This document covers the core implementation details of the EVE Vault extension.

## Core Scripts

### Background Service Worker

**Location**: `apps/extension/entrypoints/background.ts`

The background service worker handles:

- **EVE Frontier OAuth**: Supports EVE Frontier FusionAuth
- **Message handling**: Listens for `ext_login`, `logout`, `get_connected_wallets`
- **Token exchange**: Exchanges auth codes for tokens via provider-specific endpoints
- **Storage management**: Persists tokens to `chrome.storage.local`
- **Event emission**: Sends `auth_success`/`auth_error` messages to popup
- **Signing requests**: Handles `sign_transaction`, `sign_personal_message`, `sign_and_execute_transaction`

**Key Features:**

- Provider-specific configuration (endpoints, credentials, scopes)
- Async message handling with proper error handling
- Chrome extension redirect URI support
- Storage-first pattern (messages are best-effort)

**Implementation**: `apps/extension/src/lib/background/`

- `handlers/` - Message and port handlers
- `services/` - OAuth and storage services

### Content Script

**Location**: `apps/extension/entrypoints/content.ts`

- Injects `injected.js` into page context for wallet standard registration
- Bridges messages between page and background script via `window.postMessage`
- Forwards dApp requests to background
- Relays background responses back to page context

### Injected Script

**Location**: `apps/extension/entrypoints/injected.ts`

- Runs in page context (same as dApps)
- Registers wallet via `registerWallet(new EveVaultWallet())`
- Enables dApp discovery using `@mysten/wallet-standard`
- Uses dynamic imports to avoid bundling issues

**Wallet Implementation**: `apps/extension/src/lib/adapters/SuiWallet.ts`

### Popup UI

**Location**: `apps/extension/src/features/wallet/components/PopupApp.tsx`

- Main UI with login/logout, address display, Sui balance
- Conditional rendering based on authentication state
- Shows buttons to generate ZK proofs and sign with ephemeral keys

## Authentication

### Auth Configuration

**Location**: `apps/extension/src/features/auth/api/authConfig.ts`

- Configures `oidc-client-ts` with localStorage polyfill for extension contexts
- Sets up `UserManager` for OIDC flows
- Handles EVE Frontier FusionAuth OAuth providers

### Token Exchange

**Location**: `apps/extension/src/features/auth/api/exchangeCode.ts`

- Provider-aware token exchange (FusionAuth)
- Different endpoints and credentials per provider
- Returns tokens with provider identification

### Enoki Integration

**Location**: `packages/shared/src/auth/enoki.ts`

- Integrates with Enoki API for zkLogin address derivation
- Fetches salt and address from Enoki service
- Requires `VITE_ENOKI_API_KEY`

### ZK Proof Generation

**Location**: `packages/shared/src/wallet/zkProof.ts`

- Generates ZK proofs for zkLogin authentication
- Retrieves session data (nonce, jwtRandomness, ephemeralKeyPair)
- Gets salt and tokens from storage
- Creates extended ephemeral public key
- Sends payload to Sui's ZK prover endpoint

## Wallet Implementation

### SuiWallet Class

**Location**: `apps/extension/src/lib/adapters/SuiWallet.ts`

Implements `@mysten/wallet-standard` `Wallet` interface:

**Features:**

- `standard:connect` - Connect wallet to dApp
- `standard:disconnect` - Disconnect wallet
- `standard:events` - Event subscription
- `sui:signPersonalMessage` - Sign personal messages
- `sui:signTransaction` - Sign transactions
- `sui:signAndExecuteTransaction` - Sign and execute
- `sui:reportTransactionEffects` - Report transaction effects

**Chains:** Supports devnet, testnet, and mainnet

## State Management

### Auth Store

**Location**: `apps/extension/src/features/auth/stores/authStore.ts`

Manages authentication state:

- **State**: `user`, `loading`, `error`
- **Actions**: `login()`, `logout()`, `initialize()`, `setUser()`
- **EVE Frontier support**: Handles EVE Frontier FusionAuth
- **Custom data**: Stores `sui_address` in user profile
- **OIDC integration**: Syncs with `oidc-client-ts` UserManager
- **Event subscriptions**: Reactive updates via UserManager events

**Note:** Does not use persist middleware (relies on UserManager storage)

### Device Store

**Location**: `packages/shared/src/stores/deviceStore.ts`

Manages zkLogin-specific parameters with **Zustand persist middleware**:

**State:**

- `ephemeralKeyPair`: Ed25519 keypair for signing (shared across networks)
- `ephemeralPublicKey`: Public key derived from ephemeral keypair
- `isLocked`: Whether the vault is locked
- `networkData`: Per-network zkLogin parameters:
  - `jwtRandomness`: Random value for nonce generation (per-network)
  - `maxEpoch`: Current Sui epoch + 2 (validity window, per-network)
  - `nonce`: Generated nonce for zkLogin (per-network)

**Actions:**

- `initialize(pin: string)`: Creates new ephemeral keypair and unlocks vault
- `lock()`: Locks the vault (clears ephemeral keypair)
- `initializeForChain(chain: SuiChain)`: Generates per-network device data (nonce, maxEpoch, jwtRandomness)
- `getZkProof(chain: SuiChain)`: Retrieves or generates ZK proof for a specific network

**Storage Strategy:**

- **Zustand persist**: Saves to `chrome.storage.local` under key `"evevault:device"`
- **Automatic hydration**: State restored on popup reopen
- **Per-network data**: Device data stored per-network to prevent cross-network conflicts
- **Initialization guard**: Prevents regenerating keys if data exists

**Important:** Per-network isolation ensures that switching networks doesn't invalidate existing JWTs on other networks

### Persistent Store

**Location**: `packages/shared/src/adapters/extension.ts`

General-purpose persistent storage:

- Provides `chromeStorageAdapter` for Zustand persist middleware
- Exports reusable storage adapter for other stores
- Handles both Chrome extension and web contexts

### Store Accessor

**Location**: `apps/extension/src/features/*/stores/` (if exists)

Safe accessors for Zustand stores in non-React environments:

- `getAuthState()`: Access auth store from service workers
- `getDeviceState()`: Access device store from service workers
- Fallback handling for store initialization failures

## Network Switching

**Location**: `packages/shared/src/stores/networkStore.ts`, `packages/shared/src/components/CurrentNetworkDisplay/`

The extension supports multi-network operation with per-network data isolation:

- **Network Store**: Manages current network state with persistence (`useNetworkStore`)
- **Network Selector**: UI component for switching between networks (`CurrentNetworkDisplay`)
- **Per-network JWTs**: Each network stores its own JWT tokens in `chrome.storage.local` under `evevault:jwt`
- **Per-network device data**: Nonce, maxEpoch, and jwtRandomness stored per-network in `deviceStore.networkData`
- **Automatic rollback**: Login failures trigger rollback to previous network with valid JWT
- **Seamless switching**: If user is already logged in on target network, switching is instant

**Key Components:**
- `useNetworkStore` - Network state management (`packages/shared/src/stores/networkStore.ts`)
- `CurrentNetworkDisplay` - Network selector UI (`packages/shared/src/components/CurrentNetworkDisplay/`)
- `AVAILABLE_NETWORKS` - Shared network constants (`packages/shared/src/types/networks.ts`)

**Network Switching Flow:**
1. User clicks network selector → `checkNetworkSwitch()` checks if JWT exists for target network
2. If JWT exists → `setChain()` performs seamless switch (updates device data if needed)
3. If no JWT → shows "Sign In Required" dialog → user confirms → switches network → prompts login
4. If login fails → automatically reverts to previous network (or any network with valid JWT)

**Per-Network Data Isolation:**
- JWTs: `evevault:jwt[sui:devnet]` vs `evevault:jwt[sui:testnet]`
- Device data: `deviceStore.networkData[sui:devnet]` vs `deviceStore.networkData[sui:testnet]`
- Network state: `evevault:network` stores current `chain`

## React Hooks

### useAuth

**Location**: `apps/extension/src/features/auth/hooks/useAuth.ts`

Simple facade over `authStore`:

- Exposes: `user`, `login`, `logout`, `loading`, `error`
- For use in React components

### useDevice

**Location**: `apps/extension/src/features/wallet/hooks/useDevice.ts`

Facade over `deviceStore`:

- Exposes zkLogin parameters
- For use in React components

## Utilities

### Auth Cleanup

**Location**: `packages/shared/src/utils/authCleanup.ts`

Cleans up OIDC storage and extension storage on logout:

- Removing OIDC-related localStorage entries
- Clearing Chrome storage (local and session)
- Resetting all authentication state

### Constants

**Location**: `packages/shared/src/utils/constants.ts`

Application constants including Sui prover endpoint URLs.

### Key Utilities

**Location**: `packages/shared/src/utils/keys/`

Encryption/decryption utilities for private keys:

- `deriveEncryptionKey.ts`: Derives encryption keys from passwords
- `encrypt.ts`: Encrypts private keys for storage
- `decrypt.ts`: Decrypts stored private keys

### Transaction Building

**Location**: `packages/shared/src/utils/buildTx.ts`

Builds Sui transactions with proper sender address.

## Chrome Storage Usage

### `chrome.storage.local` (Persistent)

- `evevault:device`: Zustand deviceStore state (JSON)
  - Contains `ephemeralPublicKey`, `isLocked`, and `networkData` object
  - `networkData[sui:devnet]`: Per-network `jwtRandomness`, `nonce`, `maxEpoch`
  - `networkData[sui:testnet]`: Per-network `jwtRandomness`, `nonce`, `maxEpoch`
- `evevault:jwt`: Per-network token data
  - `evevault:jwt[sui:devnet]`: JWT tokens for devnet
  - `evevault:jwt[sui:testnet]`: JWT tokens for testnet
- `evevault:network`: Current network state (`chain`)

### `chrome.storage.session` (Cleared on browser close)

- Ephemeral keypair (stored securely in Keeper offscreen document for extension)
- Sensitive ephemeral data

## Current State & Limitations

### Working Features

- ✅ EVE Frontier OAuth (FusionAuth)
- ✅ zkLogin address derivation via Enoki
- ✅ Sui balance display
- ✅ Ephemeral keypair generation and management
- ✅ ZK proof request preparation
- ✅ Wallet Standard registration and detection
- ✅ Reactive state management with Zustand
- ✅ Chrome storage persistence with automatic hydration
- ✅ Provider-specific OAuth configuration

### Known Limitations

- **ZK Prover Integration**: The Sui ZK prover may not support all custom OAuth providers. The `zkProof()` function prepares the request but actual proof generation depends on Sui's prover support.

- **Transaction Signing**: While ephemeral key signing works, the full zkLogin signature combining (ephemeral signature + ZK proof) requires complete prover integration.

- **Enoki Dependency**: zkLogin address derivation currently depends on Mysten Labs Enoki API.

- **MaxEpoch Expiry**: While `maxEpoch` is calculated and stored, there's no automatic refresh mechanism when it expires. Users need to re-login after the epoch window passes.

- **Error Handling**: Wallet standard errors and OAuth failures could be more gracefully handled with better user feedback.

- **Signing UX**: The background script signing methods show transaction details to the user and request approval via popup windows.

### TODOs

- [ ] Implement full zkLogin signature combining
- [ ] Add maxEpoch expiry detection and auto-refresh
- [ ] Improve error recovery and retry logic
- [ ] Improve wallet standard error reporting
- [ ] Add transaction history and activity log
- [ ] Implement account switching (multi-user support)
- ~~[ ] Add network switching UI (devnet/testnet/mainnet)~~ ✅ **Completed** - Network switching UI implemented with `CurrentNetworkDisplay` component

## Related Documentation

- [Development Guide](./DEVELOPMENT.md) - Development workflow and debugging
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Monorepo README](./MONOREPO_README.md) - Project structure
