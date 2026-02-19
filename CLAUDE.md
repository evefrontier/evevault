# EVE Vault – Claude Code Guidelines

## Git Workflow
- **All changes must go through pull requests** — direct pushes to `main` are blocked by branch protection
- **All PRs should be squash merged**
- **Keep PRs small and focused** — one concern per PR, avoid bundling unrelated changes
- Always create a new branch from latest `main` before making changes
- Use `bun` as the package manager and runtime (not npm or yarn)
