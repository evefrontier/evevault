# Playwright E2E Setup

This folder hosts the Playwright runner for browser-based regression tests. The branch purpose is **setup only**—no specs ship yet. Create test files under `tests/e2e/*.spec.ts` once the critical wallet flows are ready.

## Stack

- [Playwright](https://playwright.dev) for driving Chromium
- The web app running on `http://localhost:3001`
- Real Sui **devnet** data so responses mirror production as closely as possible

## Running Playwright

```bash
# Run the suite headless (default)
bun run e2e

# Launch with the Playwright UI
bun run e2e:ui

# Headed run for quick debugging
bunx playwright test --headed

# Open the last HTML report
npx playwright show-report
```

The config (`playwright.config.ts`) automatically spawns `bun run dev:web`. If a dev server is already running on port 3001 it will be reused.

## Existing Specs

- `balance.spec.ts`: Seeds a fake authenticated session, mocks the Sui RPC, and asserts that the wallet screen renders the formatted SUI balance for the active chain. Use this as a template for future wallet-centric flows.

### Test Utilities

- `tests/e2e/helpers/state.ts` – Seeds the persisted Zustand stores (`auth`, `device`, `network`) so tests can start from an authenticated, unlocked state without relying on FusionAuth or the extension background.
- `tests/e2e/helpers/suiRpc.ts` – Intercepts calls to the public Sui fullnode and serves deterministic JSON-RPC responses (e.g., `sui_getLatestSuiSystemState`, `suix_getBalance`). Add new handlers here as additional endpoints are required.

## Adding Tests Later

When it is time to add specs:

1. Create a new `*.spec.ts` in this directory (one per user flow).
2. Exercise **critical flows only** (login, transfer, token management).
3. Drive the UI exactly how a user would; avoid backdoor API shortcuts.
4. Always assert on the actual response shown to the user so we know we “get the right response”.
5. Seed and reuse **Sui devnet** accounts—no mock wallets or fake data.

### Best Practices

- Prefer `getByRole`/`getByLabel` over brittle selectors.
- Keep specs independent; reset state inside each test.
- Record traces (`bun run e2e --trace on`) when chasing flakes.
- Store helper utilities beside the specs that consume them to keep scope local.

## Artifacts

- Reports: `playwright-report/`
- Traces & screenshots: `test-results/`

Clean them up as needed; they are gitignored by default.
