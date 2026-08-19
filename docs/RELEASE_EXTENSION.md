# Release extension (CI)

Workflow: [`.github/workflows/release-extension.yml`](../.github/workflows/release-extension.yml).

**Runs on:** publishing a GitHub Release, or **Run workflow** in Actions. Not on pull requests (the job also guards against a mistaken `pull_request` trigger).

**Output:** `eve-vault-chrome.zip` and `eve-vault-firefox.zip` — attached to the release, or as a workflow artifact when run manually. Stable URLs: `https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip` and `https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-firefox.zip`. `checksums.txt` covers both zips, and the attestation is generated over that checksums file.

**Secrets:** the names checked in the workflow (tenant `VITE_*` secrets, `VITE_FUSIONAUTH_*`, `EXTENSION_ID`). Use the GitHub **`build`** environment if your org scopes secrets there. `EXTENSION_ID` is Chrome `manifest.key` (base64 public key), not the 32-character id — see [`apps/extension/wxt.config.ts`](../apps/extension/wxt.config.ts).

`VITE_*` values are inlined into the bundle at build time.
