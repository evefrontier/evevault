# Testing Quick Reference Guide

Quick reference for writing and running tests in the EVE Vault repository.

## Running Tests

### Unit/Component/Integration Tests
```bash
bun run test          # Watch mode
bun run test:ui       # Visual UI dashboard
bun run test:run      # Single run (CI)
```

### E2E Tests
```bash
bun run e2e           # Headless
bun run e2e:ui        # With browser UI
bunx playwright test --debug <file>  # Debug mode
```

### Specific Workspace
```bash
bunx turbo run test --filter=@evevault/shared
bunx turbo run test --filter=@evevault/web
```

### Coverage
```bash
bunx vitest run --coverage
open coverage/index.html
```

## Test File Patterns

### Component Test Template
```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YourComponent } from "./YourComponent";

describe("YourComponent", () => {
  it("renders correctly", () => {
    render(<YourComponent />);
    expect(screen.getByRole("button")).toBeVisible();
  });

  it("handles user interaction", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<YourComponent onClick={handleClick} />);
    
    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Test Template
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useYourStore } from "../yourStore";

describe("Your Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useYourStore.setState({ /* initial state */ });
  });

  it("coordinates between stores", async () => {
    const result = await useYourStore.getState().yourAction();
    expect(result.success).toBe(true);
  });
});
```

### E2E Test Template
```typescript
import { expect, test } from "@playwright/test";
import { seedPersistedAppState } from "./helpers/state";

test.describe("Your Feature", () => {
  test.beforeEach(async ({ page }) => {
    await seedPersistedAppState(page);
  });

  test("user can complete workflow", async ({ page }) => {
    await page.goto("/your-page");
    
    await page.getByRole("button", { name: /action/i }).click();
    
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

## Common Patterns

### Mocking Stores
```typescript
vi.mock("../../stores/yourStore", () => ({
  useYourStore: vi.fn(),
}));

import { useYourStore } from "../../stores/yourStore";

// In test
vi.mocked(useYourStore).mockReturnValue({
  data: mockData,
  loading: false,
  error: null,
});
```

### Mocking Hooks
```typescript
vi.mock("../../hooks/useYourHook", () => ({
  useYourHook: vi.fn(),
}));

import { useYourHook } from "../../hooks/useYourHook";

// In test
vi.mocked(useYourHook).mockReturnValue({
  value: "mocked",
});
```

### User Interactions
```typescript
const user = userEvent.setup();

// Click
await user.click(element);

// Type
await user.type(input, "text");

// Keyboard
await user.keyboard("{Enter}");
await user.keyboard("{Escape}");
```

### Async Testing
```typescript
// Wait for element
await waitFor(() => {
  expect(screen.getByText(/result/i)).toBeVisible();
});

// Wait with timeout
await waitFor(() => {
  expect(condition).toBe(true);
}, { timeout: 5000 });

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText(/old/i)).not.toBeInTheDocument();
});
```

### Timer Management
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// In test
vi.advanceTimersByTime(3000);  // Fast-forward 3 seconds
```

## Common Queries

### Semantic Queries (Preferred)
```typescript
// By role
screen.getByRole("button", { name: /submit/i })
screen.getByRole("textbox", { name: /email/i })

// By label
screen.getByLabelText(/username/i)

// By text
screen.getByText(/welcome/i)

// By test ID (last resort)
screen.getByTestId("wallet-balance")
```

### Query Variants
```typescript
getBy...     // Throws if not found
queryBy...   // Returns null if not found
findBy...    // Async, waits for element
```

## E2E Helpers

### Mock RPC Responses
```typescript
import { mockSuiRpc } from "./helpers/suiRpc";

// Basic usage
await mockSuiRpc(page);

// Custom balance
await mockSuiRpc(page, { balance: "5000000000" });
```

### Seed Auth State
```typescript
import { seedPersistedAppState } from "./helpers/state";

await seedPersistedAppState(page);
```

### Custom Route Mocking
```typescript
await page.route("**/api/**", async (route) => {
  if (route.request().method() === "POST") {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  } else {
    await route.continue();
  }
});
```

## Debugging

### Component Tests
```typescript
// Print DOM
import { screen } from "@testing-library/react";
screen.debug();

// Print specific element
const element = screen.getByRole("button");
screen.debug(element);
```

### E2E Tests
```bash
# Run with headed browser
bunx playwright test --headed

# Run with debug mode
bunx playwright test --debug

# Run specific test
bunx playwright test --debug tests/e2e/auth-flow.spec.ts

# Screenshot on failure (already configured)
# Videos on failure (already configured)
```

### Common Issues

**Test timeout:**
```typescript
// Increase timeout for specific test
it("slow test", async () => {
  // test code
}, { timeout: 10000 });
```

**Element not found:**
```typescript
// Use queryBy for optional elements
const element = screen.queryByText(/optional/i);
if (element) {
  // Do something
}

// Wait for async elements
const element = await screen.findByText(/async/i);
```

**Mock not working:**
```typescript
// Ensure mock is before imports
vi.mock("./module", () => ({ ... }));

import { useModule } from "./module";  // Import after mock

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Best Practices

1. ✅ Use semantic queries (getByRole, getByLabel)
2. ✅ Test user behavior, not implementation
3. ✅ Keep tests small and focused
4. ✅ Mock only external boundaries
5. ✅ Clean up after each test
6. ✅ Use descriptive test names
7. ✅ Test error cases
8. ✅ Verify accessibility
9. ✅ Handle async properly
10. ✅ Avoid test interdependencies

## What to Test

### Always Test ✅
- User interactions
- Error states
- Loading states
- Edge cases
- Accessibility
- Input validation
- State changes

### Rarely Test ⚠️
- Implementation details
- Third-party libraries
- Trivial getters/setters
- CSS styling (use visual regression instead)

## Documentation

- **Full Guide**: `docs/TESTING.md`
- **Unit Tests**: `UNIT_TEST_SUMMARY.md`
- **Comprehensive**: `COMPREHENSIVE_TESTING_SUMMARY.md`

## Getting Help

1. Check existing test files for patterns
2. Review documentation files
3. Run tests with `--ui` for visual debugging
4. Ask in #evevault-dev channel

---

**Quick Commands:**
```bash
# Most common workflow
bun run test          # Watch mode for TDD
bun run test:ui       # Visual dashboard
bun run e2e           # Full E2E suite
```
