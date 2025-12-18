# EVE Vault Wallet

EVE Vault Wallet is a Chrome MV3 extension built with WXT and React. It implements the Sui Wallet Standard to let dApps discover and connect to a user wallet. User authentication supports **EVE Frontier FusionAuth** via Chrome's `identity` API. After login, a [Sui zkLogin](https://docs.sui.io/concepts/cryptography/zklogin) address is derived and exposed to dApps via the wallet standard.

> EVE Vault is only available as a Chrome browser extension at present, with the web version coming soon.

## Features

- ✅ EVE Frontier-provider OAuth (FusionAuth)
- ✅ zkLogin address derivation via Enoki
- ✅ Wallet Standard implementation for dApp discovery
- ✅ Transaction signing with zkLogin
- ✅ Reactive state management with Zustand
- ✅ Chrome storage persistence

## How It Works

EVE Vault uses **zkLogin** to create a Sui wallet address from your OAuth credentials (FusionAuth). Instead of managing a private key, your wallet address is cryptographically derived from your authenticated identity using zero-knowledge proofs.

For detailed technical information, see the [Architecture Documentation](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md) and [Sui zkLogin docs](https://docs.sui.io/concepts/cryptography/zklogin).

## Requirements

- Node.js 22+
- Bun (recommended) or npm/pnpm
- FusionAuth application with client credentials (for EVE Frontier auth)
- Enoki API key (for zkLogin address derivation)

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Configuration

Create a `.env` file at app root, `apps/extension`:

```env
# FusionAuth Configuration
VITE_FUSION_SERVER_URL="https://auth.evefrontier.com"
VITE_FUSIONAUTH_CLIENT_ID=your-fusionauth-client-id
VITE_FUSION_CLIENT_SECRET=your-fusionauth-client-secret

# Enoki Configuration
VITE_ENOKI_API_KEY=your-enoki-api-key

# Extension Configuration
EXTENSION_ID="your-extension-public-key"
```

### 3. OAuth Provider Setup

**FusionAuth:**

1. Go to your FusionAuth admin panel
2. Navigate to Applications → Your App → OAuth
3. Add redirect URI: `https://<your-extension-id>.chromiumapp.org/`
4. Enable scopes: `openid`, `profile`, `email`

### 4. Start Development

```bash
# Run extension
bun run dev:extension

# Or run all apps
bun run dev
```

### 5. Load Extension in Browser

- **Chrome**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", and select `apps/extension/.output/chrome-mv3`

### 6. Test the Extension

1. Open the extension popup
2. Click "Sign in with EVE Vault"
3. Complete the OAuth flow
4. After success, the popup displays your zkLogin address and Sui balance

## Build

```bash
# Build extension (Chrome)
bun run build:extension

# Build all apps
bun run build
```

Output: `apps/extension/.output/chrome-mv3/`

## Code Quality

### Linting & Formatting

This project uses **[Biome](https://biomejs.dev/)** for fast formatting and linting (~35x faster than Prettier).

```bash
# Check all files
bun run lint

# Auto-fix issues
bun run lint --write

# Check specific workspace
bunx turbo run lint --filter=@evevault/web
```

### Pre-commit Hooks

**Husky** + **lint-staged** automatically format and lint staged files on commit:

- Runs `biome check --write` on staged `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css` files
- Auto-fixes formatting, import order, and style issues
- Blocks commit if unfixable errors remain

**Configuration:**
- `biome.json` - Formatting and linting rules
- `.biomeignore` - Files to ignore
- `.husky/pre-commit` - Pre-commit hook script

**VS Code Integration:**
Install the Biome extension for real-time feedback:
```bash
code --install-extension biomejs.biome
```

## Project Structure

This is a **monorepo** using Bun workspaces and Turborepo:

```
eve-frontier-vault-sui/
├── packages/
│   └── shared/              # Cross-platform business logic
└── apps/
    ├── extension/           # Browser extension
    └── web/                 # Web application
```

For detailed structure and architecture, see [Monorepo Documentation](./docs/MONOREPO_README.md).

## Documentation

- **[Monorepo Guide](./docs/MONOREPO_README.md)** - Structure, getting started, commands
- **[Architecture](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md)** - ZKLogin and auth flow
- **[Bun + Turborepo Setup](./docs/BUN_TURBO_SETUP.md)** - Tooling deep-dive
- **[Development Guide](./docs/DEVELOPMENT.md)** - Development workflow, debugging, tips
- **[Implementation Details](./docs/IMPLEMENTATION.md)** - Core scripts, authentication, wallet implementation
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Usage

### For dApp Integration

```typescript
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";

<WalletProvider
  autoConnect
  walletFilter={(wallet) => wallet.name.includes("Eve Vault")}
>
  <App />
</WalletProvider>;
```

The extension registers as "Eve Vault" in the page context. Connecting triggers the login flow if the user isn't authenticated.

### For Extension Users

1. Click the extension icon to open the popup
2. Complete the OAuth flow
3. The wallet is automatically available to all dApps once authenticated

## Current State

### Working Features

- FusionAuth OAuth Provider
- zkLogin address derivation via Enoki
- Sui balance display
- Ephemeral keypair generation
- ZK proof request preparation
- Wallet Standard registration
- Reactive state management

### Known Limitations

- MaxEpoch expiry requires manual re-login
- Network switching is not gracefully handled for different epochs

For detailed limitations and TODOs, see [Implementation Details](./docs/IMPLEMENTATION.md#current-state--limitations).

## Contributing

1. Follow the [Development Guide](./docs/DEVELOPMENT.md)
2. Review the [Architecture Decision Record](./docs/adr/001-hybrid-monorepo-structure.md)
3. Check [Troubleshooting](./docs/TROUBLESHOOTING.md) for common issues

## Acknowledgements

- Built with [WXT](https://wxt.dev/) and React
- Sui Wallet Standard: [@mysten/wallet-standard](https://sdk.mystenlabs.com/dapp-kit/wallet-standard)
- ZKLogin: [@mysten/sui/zklogin](https://docs.sui.io/concepts/cryptography/zklogin)
- State Management: [Zustand](https://zustand-demo.pmnd.rs/)
- Auth: [oidc-client-ts](https://github.com/authts/oidc-client-ts) + FusionAuth
- zkLogin Integration: [Enoki by Mysten Labs](https://docs.enoki.mystenlabs.com/)
