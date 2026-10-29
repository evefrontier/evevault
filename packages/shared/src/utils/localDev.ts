import type { TenantId } from '@evefrontier/wallet-core/tenant'

/**
 * LOCAL_DEV: running against the eve-frontier-local-dev stack (its
 * `make evevault` sets VITE_LOCAL_DEV=true; release builds never do). With it:
 *
 * - a `local` tenant signs in at the stack's FusionAuth stand-in;
 * - the API gateway is the stack's, for every tenant, so other tenants do not
 *   work in such a build;
 * - localnet is a zkLogin chain like devnet and testnet, reading through the
 *   stack's Sui GraphQL server, instead of the local-key localnet mode.
 */
export const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === 'true'

export const LOCAL_TENANT_ID = 'local' as TenantId

export const LOCAL_DEV_AUTH_URL =
  import.meta.env.VITE_LOCAL_DEV_AUTH_URL || 'http://localhost:8480'

export const LOCAL_DEV_API_URL =
  import.meta.env.VITE_LOCAL_DEV_API_URL || 'http://localhost:8088'

export const LOCAL_DEV_SUI_URL =
  import.meta.env.VITE_LOCAL_DEV_SUI_URL || 'http://127.0.0.1:9000'

export const LOCAL_DEV_GRAPHQL_URL =
  import.meta.env.VITE_LOCAL_DEV_GRAPHQL_URL || 'http://127.0.0.1:9125/graphql'

/** The stack's MVR API (mvr-stub), standing in for Mysten's on localnet. */
export const LOCAL_DEV_MVR_URL =
  import.meta.env.VITE_LOCAL_DEV_MVR_URL || 'http://127.0.0.1:9126'

/**
 * The stack's EVE coin type by MVR name, the name world-contracts' SDK gives
 * its currency package on localnet. Every genesis publishes it at a new
 * address, so it is resolved through LOCAL_DEV_MVR_URL, never built in.
 */
export const LOCAL_DEV_EVE_MVR_TYPE = `${
  import.meta.env.VITE_LOCAL_DEV_CURRENCY_MVR_NAME || '@evefrontier/currency'
}::EVE::EVE`
