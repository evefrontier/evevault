# Bun + Turborepo Setup

> **Note**: For getting started, see [Monorepo README](./MONOREPO_README.md).  
> For general information, see [Turborepo docs](https://turbo.build/repo/docs) and [Bun docs](https://bun.sh/docs).

## Project Configuration

### Root `package.json`

```json
{
  "packageManager": "bun@1.3.1",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  }
}
```

### `turbo.json`

Our Turborepo configuration:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".wxt/**", ".output/**", "build/**"],
      "env": ["VITE_*", "EXTENSION_ID"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["VITE_*", "EXTENSION_ID"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Key points:**
- `build` depends on dependencies (`^build`) and outputs to `dist/`, `.output/`, etc.
- `dev` is persistent (no cache) and includes environment variables
- `typecheck` requires dependencies to be built first

## Troubleshooting

### Turbo can't find Bun

Ensure `packageManager` is set in root `package.json`:
```json
"packageManager": "bun@1.3.1"
```

### Caching issues

- Check `.turbo/` directory exists and has write permissions
- Clear cache: `turbo run clean`
- See [Turborepo caching docs](https://turbo.build/repo/docs/core-concepts/caching)

## Related Documentation

- [Monorepo README](./MONOREPO_README.md) - Main guide for using the monorepo
- [Turborepo Documentation](https://turbo.build/repo/docs) - Official Turborepo docs
- [Bun Documentation](https://bun.sh/docs) - Official Bun docs
- [Architecture Decision Record](./adr/001-hybrid-monorepo-structure.md) - Structure decisions
