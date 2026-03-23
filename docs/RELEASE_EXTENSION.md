# Release extension (CI)

Workflow: [`.github/workflows/release-extension.yml`](../.github/workflows/release-extension.yml).

**Runs on:** publishing a GitHub Release, or **Run workflow** in Actions. Not on pull requests (the job also guards against a mistaken `pull_request` trigger).

**Output:** `eve-vault-chrome.zip` — attached to the release, or as a workflow artifact when run manually. Stable URL: `https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip`.

**Secrets:** the names checked in the workflow (tenant `VITE_*` secrets, `VITE_FUSIONAUTH_*`, `VITE_ENOKI_API_KEY`, `EXTENSION_ID`). Use the GitHub **`build`** environment if your org scopes secrets there. `EXTENSION_ID` is Chrome `manifest.key` (base64 public key), not the 32-character id — see [`apps/extension/wxt.config.ts`](../apps/extension/wxt.config.ts).

`VITE_*` values are inlined into the bundle at build time.
