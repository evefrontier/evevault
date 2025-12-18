# Component Placement Guide

## Quick Decision Tree

```
Is the component feature-specific?
├─ YES → Put it in: apps/{extension|web}/src/features/{feature}/components/
└─ NO → Is it reusable across features in the same app?
    ├─ YES → Put it in: apps/{extension|web}/src/lib/components/
    └─ NO → Is it reusable across platforms (extension + web)?
        └─ YES → Consider: packages/shared/ui/ (if pure, no React deps)
```

## Scenario: Adding a Card Component with Title

### Step 1: Determine the Scope

**Ask yourself:**
- **Where will this card be used?**
  - Only in the wallet feature? → Feature-specific
  - In multiple features (wallet, auth, etc.)? → App-level shared
  - In both extension AND web apps? → Platform-shared (rare)

### Step 2: Choose the Location

#### Option A: Feature-Specific Card (Most Common)

**Location:** `apps/{extension|web}/src/features/{feature}/components/Card.tsx`

**When to use:**
- Card is only used within one feature (e.g., wallet balance card)
- Card has feature-specific logic or styling
- Card is tightly coupled to a specific feature

**Example Structure:**
```
apps/extension/src/features/wallet/components/
├── Card.tsx              # Your new card component
├── Card.css              # Card-specific styles (optional)
├── PopupApp.tsx          # Uses Card
└── ...
```

**Implementation Example:**
```typescript
// apps/extension/src/features/wallet/components/Card.tsx
import { colors, spacing } from "@evevault/shared/design";

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
      }}
    >
      <h3 style={{ color: colors.text, marginBottom: spacing.sm }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
```

**Usage:**
```typescript
// apps/extension/src/features/wallet/components/PopupApp.tsx
import { Card } from "./Card";

function App() {
  return (
    <Card title="Wallet Balance">
      <p>100 SUI</p>
    </Card>
  );
}
```

#### Option B: App-Level Shared Component

**Location:** `apps/{extension|web}/src/lib/components/Card.tsx`

**When to use:**
- Card is used across multiple features in the same app
- Card is a generic UI component (no feature-specific logic)
- You want to avoid duplication between features

**Example Structure:**
```
apps/extension/src/lib/
├── components/
│   ├── Card.tsx          # Shared card component
│   └── Button.tsx         # Other shared components
├── adapters/
└── background/
```

**Implementation Example:**
```typescript
// apps/extension/src/lib/components/Card.tsx
import { colors, spacing, typography } from "@evevault/shared/design";

interface CardProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "outlined";
}

export function Card({ title, children, variant = "default" }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: variant === "outlined" ? "transparent" : colors.surface,
        padding: spacing.md,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
      }}
    >
      <h3
        style={{
          color: colors.text,
          marginBottom: spacing.sm,
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
```

**Usage in Features:**
```typescript
// apps/extension/src/features/wallet/components/PopupApp.tsx
import { Card } from "../../lib/components/Card";

// apps/extension/src/features/auth/components/LoginCard.tsx
import { Card } from "../../lib/components/Card";
```

#### Option C: Platform-Shared Component (Rare)

**Location:** `packages/shared/ui/Card.tsx` (if created)

**When to use:**
- Component needs to be identical across extension AND web
- Component has no platform-specific dependencies
- Component is pure UI (no React hooks that differ by platform)

**⚠️ Note:** Currently, `packages/shared/` doesn't include React components. If you need this, you'd need to:
1. Add React as a peer dependency to `packages/shared/package.json`
2. Create `packages/shared/src/ui/` directory
3. Export components from `packages/shared/src/index.ts`

**This is generally NOT recommended** unless you have a strong need for identical components across platforms.

## Best Practices

### 1. Always Use Design Tokens

**✅ DO:**
```typescript
import { colors, spacing, typography } from "@evevault/shared/design";

<div style={{ padding: spacing.md, color: colors.text }}>
```

**❌ DON'T:**
```typescript
<div style={{ padding: "16px", color: "#ffffff" }}>
```

### 2. Keep Components Close to Usage

**✅ DO:** Start with feature-specific, move to shared if needed
- Easier to find and maintain
- Clear ownership
- Can refactor later if needed

**❌ DON'T:** Create shared components prematurely
- Premature abstraction leads to complexity
- Harder to change later

### 3. File Naming Conventions

- **Components:** PascalCase (`Card.tsx`, `WalletBalance.tsx`)
- **Styles:** Match component name (`Card.css`, `Card.module.css`)
- **Folders:** kebab-case (`sign-transaction/`)

### 4. Component Structure

```typescript
// 1. Imports (external first, then internal)
import { colors, spacing } from "@evevault/shared/design";
import { Card } from "../../lib/components/Card";

// 2. Types/Interfaces
interface MyCardProps {
  title: string;
  children: React.ReactNode;
}

// 3. Component
export function MyCard({ title, children }: MyCardProps) {
  // Implementation
}

// 4. Export (if needed)
export default MyCard;
```

## Real-World Example: Adding a Balance Card

**Scenario:** New developer wants to add a card showing wallet balance in the extension popup.

**Senior Dev's Response:**

> "Since this card is specific to the wallet feature and only shows balance, let's put it in the wallet feature's components folder.
>
> 1. **Create:** `apps/extension/src/features/wallet/components/BalanceCard.tsx`
> 2. **Use design tokens** from `@evevault/shared/design` for colors and spacing
> 3. **Import and use** in `PopupApp.tsx` (same folder)
>
> If you later need a similar card in the auth feature, we can extract it to `apps/extension/src/lib/components/Card.tsx` and make it more generic. But for now, keep it simple and feature-specific."

**Implementation:**
```typescript
// apps/extension/src/features/wallet/components/BalanceCard.tsx
import { colors, spacing, typography } from "@evevault/shared/design";

interface BalanceCardProps {
  balance: number;
  currency?: string;
}

export function BalanceCard({ balance, currency = "SUI" }: BalanceCardProps) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
      }}
    >
      <h3
        style={{
          color: colors.textSecondary,
          fontSize: typography.fontSize.sm,
          marginBottom: spacing.xs,
        }}
      >
        Balance
      </h3>
      <p
        style={{
          color: colors.text,
          fontSize: typography.fontSize["2xl"],
          fontWeight: typography.fontWeight.bold,
          margin: 0,
        }}
      >
        {balance} {currency}
      </p>
    </div>
  );
}
```

```typescript
// apps/extension/src/features/wallet/components/PopupApp.tsx
import { BalanceCard } from "./BalanceCard";

function App() {
  return (
    <div>
      <BalanceCard balance={100} />
      {/* ... other components */}
    </div>
  );
}
```

## Summary

**For a card component with title:**

1. **Start feature-specific:** `apps/{app}/src/features/{feature}/components/Card.tsx`
2. **Use design tokens:** Import from `@evevault/shared/design`
3. **Keep it simple:** Don't over-engineer
4. **Refactor later:** Move to `lib/components/` if you need it in multiple features

**Remember:** It's easier to extract a component later than to untangle an over-abstracted one!

