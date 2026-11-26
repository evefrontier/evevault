# Web image (CI)

Workflow: [`.github/workflows/image-web.yml`](../.github/workflows/image-web.yml). Image: [`apps/web/Dockerfile`](../apps/web/Dockerfile).

**Runs on:** publishing a GitHub Release whose `v*` tag must match the `apps/web/package.json` version, or **Run workflow** in Actions.

**Output:** one image per tier and architecture, pushed to ECR `frontier/eve-frontier-evevault-web` as `<version>-<tier>-<arch>` (tiers `dev test uat ptu live`, arches `amd64 arm64`). Each arch job builds and Grype-scans every tier, and pushes only once all of them pass. A manual run builds and scans every image but never pushes.

**Tiers:** the `TIER` build arg becomes `VITE_TIER`, which limits the server list to that tier's tenants (`tier` in `TENANT_KEYS`, [`packages/shared/src/utils/constants.ts`](../packages/shared/src/utils/constants.ts)), regardless of dev mode. `dev` lists every tenant. Builds without a tier (the extension, local dev) keep the dev-mode and origin-based filtering.

| Tier | Servers |
| ---- | ------- |
| live | Stillness |
| ptu  | Liminality |
| uat  | Utopia, Umbra |
| test | Tauceti, Tesseract, Tetra, Tiaki |
| dev  | all |

Local build:

```sh
GITHUB_TOKEN=... docker build -f apps/web/Dockerfile --build-arg TIER=live \
  --secret id=github_token,env=GITHUB_TOKEN -t evevault-web:live .
```
