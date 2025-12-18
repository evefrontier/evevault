# Testing Guide

This document outlines how we run tests in the EVE Vault monorepo. The focus for this setup PR is providing the tooling; individual specs can be layered on top once each feature stabilizes.

## Testing Stack

- **Vitest** – unit and integration tests (Vite-native, fast watch mode)
- **React Testing Library** – component- and hook-level behavior tests
- **Playwright** – browser-based end-to-end smoke tests

## When To Write Tests

Always cover the following areas as features firm up:

- Business logic (utilities, formatters, calculations)
- Store logic (Zustand setters, derived state, persistence)
- Hooks (custom orchestrators)
- API/data transformations
- Critical user journeys (login, transfer, token management)

## Test File Placement

```
src/
├── utils/
│   ├── __tests__/
│   │   ├── format.test.ts
│   │   └── address.test.ts
│   ├── format.ts
│   └── address.ts
├── hooks/
│   ├── __tests__/
│   │   └── useBalance.test.ts
│   └── useBalance.ts
└── components/
    └── Button/
        ├── Button.tsx
        └── Button.test.tsx
```

Co-locate tests with the code they verify. Use `__tests__` folders for plain TS modules and `Component.test.tsx` siblings for UI.

## Running Tests

```bash
# Unit / integration
bun run test          # watch mode via Turbo
bun run test:ui       # Vitest UI dashboard
bun run test:run      # Single run for CI

# Specific workspace
bunx turbo run test --filter=@evevault/shared

# E2E (Playwright)
bun run e2e           # headless
bun run e2e:ui        # Playwright UI / headed mode
bunx playwright test --debug  # debug helper
```

## Writing Tests

### Unit Example (Vitest)

```typescript
import { describe, expect, it } from "vitest";
import { formatAddress } from "../address";

describe("formatAddress", () => {
  it("compacts long addresses", () => {
    expect(formatAddress("0x1234567890abcdef")).toBe("0x1234...cdef");
  });
});
```

### Component Example

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders provided label", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeVisible();
  });
});
```

### E2E Example (skeleton)

```typescript
import { test, expect } from "@playwright/test";

test("user can add a token", async ({ page }) => {
  await page.goto("/wallet");
  await page.getByRole("button", { name: /add token/i }).click();
  await page.getByPlaceholder(/0x.*::module::COIN/i).fill("0x2::sui::SUI");
  await page.getByRole("button", { name: /add/i }).click();
  await expect(page.getByText("0x2::sui")).toBeVisible();
});
```

## Testing Best Practices

1. **Test behavior, not implementation** – make assertions on rendered output or API responses, ensuring we “get the right response” a user expects.
2. **Use Sui devnet data** – rely on real devnet accounts and on-chain responses instead of artificial mock data for end-to-end tests.
3. **Keep specs small** – one scenario per test, clear arrange/act/assert phases.
4. **Prefer semantic queries** – `getByRole`, `getByLabelText`, etc.
5. **Mock external services sparingly** – only when the real dependency is too slow or flaky.
6. **Deterministic E2E tests** – reset state inside each test and avoid cross-test coupling.

## CI & Pre-commit

- Linting runs in pre-commit; tests run in CI because they take longer.
- Turbo caches test results automatically, so repeated runs within a branch are fast.

## Coverage

```bash
bunx vitest run --coverage
open coverage/index.html
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Vitest fails to find config | Ensure `vitest.config.ts` exists at repo root and workspace configs extend it. |
| Tests timeout | Increase `testTimeout` in the relevant config or test block. |
| Playwright cannot launch browser | Reinstall binaries via `bunx playwright install chromium`. |

Need help beyond this doc? Ask in `#evevault-dev` with the failing command and log snippet.

