# EVE Vault Wallet

EVE Vault Wallet is a Chrome and Firefox MV3 extension and web app built with WXT and React. It implements the Sui Wallet Standard to let dApps discover and connect to a user wallet. User authentication supports **EVE Frontier FusionAuth** via Chrome's `identity` API. After login, a [Sui zkLogin](https://docs.sui.io/concepts/cryptography/zklogin) address is derived and exposed to dApps via the wallet standard.

## Features

- EVE Frontier OAuth (FusionAuth) with PKCE
- zkLogin address derivation
- Wallet Standard implementation for dApp discovery (Chrome & Firefox)
- PIN-protected vault — Argon2id (memory-hard) key derivation; decrypted keys held only in offscreen/in-process memory, never persisted
- Auto-lock 10 minutes after unlock (web + extension), with a PIN re-entry screen if the vault expires mid-approval
- Transaction simulation in the approval popup — projected balance changes, gas, object changes, events, and success/failure before signing
- Automatic zkLogin session recovery on epoch expiry (rotates keys, retries; address unchanged)
- Multi-network support (Mainnet, Devnet, Testnet, Localnet)
- Multi-tenant FusionAuth configuration
- Reports build version, commit, and platform to dApps via the wallet standard
- Strict Content-Security-Policy on extension and web surfaces
- Transaction signing with zkLogin and private key (localnet-only)
- Zustand for client state
- Browser storage persistence (extension)

## How It Works

EVE Vault uses **zkLogin** to create a Sui wallet address from your OAuth credentials (FusionAuth). Your wallet address is cryptographically derived from your authenticated identity using zero-knowledge proofs.

On Sui Localnet, signing uses a local Ed25519 keypair (imported in the app), which keeps dev/test flows simple.

After signing in, you set a **PIN**. The PIN runs through Argon2id to unlock an ephemeral signing key that lives only in memory (the extension's offscreen keeper, or the web app's tab) and is never written to storage. The vault **auto-locks 10 minutes** after unlocking; if it locks while a signing approval is open, you're prompted to re-enter your PIN before the transaction can be signed.

For detailed technical information, see the [Architecture Documentation](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md) and [Sui zkLogin docs](https://docs.sui.io/concepts/cryptography/zklogin).

## Download

**Latest release (Chrome & Firefox):**  
[https://github.com/evefrontier/evevault/releases](https://github.com/evefrontier/evevault/releases)

**Latest extension ZIPs** (CI, stable filenames):  
- Chrome: [releases/latest/download/eve-vault-chrome.zip](https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip)
- Firefox: [releases/latest/download/eve-vault-firefox.zip](https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-firefox.zip)

See [docs/RELEASE_EXTENSION.md](./docs/RELEASE_EXTENSION.md).

**Web app:**  
[https://evevault.evefrontier.com/](https://evevault.evefrontier.com/)

## Requirements

- Node.js (see [`.nvmrc`](./.nvmrc), currently 25.x)
- [Bun](https://bun.sh/) (package manager used in this repo; pinned via `packageManager` in `package.json`)
- FusionAuth public OAuth application with PKCE enabled

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Environment configuration

Create a `.env` at the **repository root** (WXT loads env from the monorepo root). OAuth client IDs and tenant URLs are configured in `packages/shared/src/utils/constants.ts`.

```env
# Extension (when required by your build / OAuth redirect)
EXTENSION_ID=
```

### 3. OAuth provider setup (FusionAuth)

1. FusionAuth admin → Applications → your app → OAuth
2. Add redirect URI: `https://<your-extension-id>.chromiumapp.org/` (extension flow)
3. Configure the application as a public OAuth client using authorization code + PKCE
4. Enable scopes: `openid`, `profile`, `email`

### 4. Start development

```bash
# Extension only (Chrome)
bun run dev:ext

# Extension only (Firefox)
bun run dev:ext:firefox

# All apps — both browsers + web
bun run dev

# All apps — Chrome + web only
bun run dev:chrome

# Web only
bun run dev:web
```

### 5. Load the extension

**Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `apps/extension/.output/chrome-mv3` (after `dev` or `build` has produced output)

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick any file inside `apps/extension/.output/firefox-mv3`

### 6. Smoke-test the popup

1. Open the extension popup
2. Sign in with your configured tenant
3. After success, you should see your zkLogin address and balance (when the network and APIs are available)
4. Use the in-app network selector to switch networks where supported

## Build

```bash
# Extension (Turborepo) — builds both Chrome and Firefox
bun run build:ext

# Web app
bun run build:web

# Both apps
bun run build

# Chrome web-store build / zip
bun run build:ext:webstore
bun run zip:ext:webstore
```

Extension artifact directories: `apps/extension/.output/chrome-mv3/` and `apps/extension/.output/firefox-mv3/`

## Code quality

### Linting and formatting

[Biome](https://biomejs.dev/) is used for format + lint.

```bash
bun run lint
bun run lint:fix
bun run typecheck
```

Run a task for one workspace, for example:

```bash
bunx turbo run lint --filter=@evevault/web
```

### Pre-commit (Husky + lint-staged)

Staged `*.{ts,tsx,js,jsx,json,css}` files are run through `biome check --write` before commit (see root `package.json` `lint-staged`).

Config: `biome.json`, `.biomeignore`, `.husky/pre-commit`.

### Tests

```bash
bun run test
bun run test:run
bunx turbo run test --filter=@evevault/shared
```

## Project structure

Monorepo: Bun workspaces + [Turborepo](https://turbo.build/).

```
evevault/
├── packages/
│   └── shared/          # Shared types, auth, wallet, UI used by web + extension
└── apps/
    ├── extension/       # WXT Chrome MV3 extension
    └── web/             # Vite + React web app
```

## Documentation

- [Release extension (CI)](./docs/RELEASE_EXTENSION.md) — GitHub Actions ZIP
- [ADR: hybrid monorepo structure](./docs/adr/001-hybrid-monorepo-structure.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Architecture (zkLogin / auth)](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md) — external ADR

## Usage

### For dApp developers

EVE Vault registers as **Eve Vault** through the [Sui Wallet Standard](https://docs.sui.io/standards/wallet-standard). Use any stack that lists Wallet Standard wallets (for example `@mysten/dapp-kit`); connect or filter for the wallet named **Eve Vault**. The extension injects the provider in pages where it is allowed to run.

Alongside the standard Sui features (connect, disconnect, sign personal message, sign transaction, sign-and-execute), EVE Vault exposes two EVE-specific features: `evefrontier:vaultVersion` (reports the build's `vaultVersion`, short `commit`, and `platform` so dApps can detect outdated installs and tell which client is connected) and a sponsored-transaction feature.

> **Verifying a sign-in server-side:** `signPersonalMessage` returns `{ bytes, signature }`. Verify the signature against a message your server **rebuilds** from a nonce it issued — never against the `bytes` the wallet returned, which are attacker-controlled and let any previously signed message be replayed. EVE Vault addresses are zkLogin, so pass a `client` to the verifier. See [Verifying a Sign-In Server-Side](https://docs.evefrontier.com/dapps/verifying-sign-in) for a full example.

### For extension users

1. Open the popup from the toolbar icon
2. Complete sign-in for your tenant
3. Once authenticated, the wallet is available to permitted sites
4. Switch Sui networks from the network selector when offered

## Known limitations

- zkLogin **maxEpoch** expiry is recovered automatically: on an expired-proof error the wallet rotates the ephemeral key and retries once (the zkLogin address is unchanged), so re-signing is largely transparent

## Contributing

1. Use **Quick start** and **Build** above for a working tree
2. Read [ADR: hybrid monorepo structure](./docs/adr/001-hybrid-monorepo-structure.md) for layout decisions
3. See [Troubleshooting](./docs/TROUBLESHOOTING.md) for common extension and env issues

## Acknowledgements

- [WXT](https://wxt.dev/) and React
- Sui Wallet Standard: [@mysten/wallet-standard](https://sdk.mystenlabs.com/dapp-kit/wallet-standard)
- zkLogin: [@mysten/sui](https://docs.sui.io/concepts/cryptography/zklogin)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [oidc-client-ts](https://github.com/authts/oidc-client-ts) + FusionAuth
