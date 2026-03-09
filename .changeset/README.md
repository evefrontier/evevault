# Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning. Extension, web, shared, and root are in a **fixed** group and always get the same version.

## Adding a new release

1. **Add a changeset** (describe the release):
   ```bash
   bun run changeset
   ```
   Choose the version bump type (patch/minor/major). All fixed packages will bump together.

2. **Apply version bumps** (updates `package.json` and CHANGELOGs):
   ```bash
   bun run version
   ```
   This runs `changeset version` and updates root, extension, web, and shared to the new version.

3. Commit the changes and open a PR. After merge, create a GitHub release with the same tag (e.g. `v0.0.5`) to trigger the release workflow.

Root, extension, web, and shared are in the same fixed group, so `bun run version` updates all of them. The extension manifest version is read from `apps/extension/package.json` at build time.
