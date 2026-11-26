import type { TenantId } from '@evefrontier/wallet-core/tenant'

/** Deployment tier a web image is built for. */
export type Tier = 'dev' | 'test' | 'uat' | 'ptu' | 'live'

export interface TenantConfig {
  clientId: string
  serverUrl: string
  webOrigin: string
  /** Tier whose web build serves this tenant. The dev tier serves all of them. */
  tier: Exclude<Tier, 'dev'>
  isDev?: boolean
}

export interface TenantState {
  devMode: boolean
  setDevMode: (value: boolean) => void
  tenantId: TenantId
  setTenantId: (id: TenantId) => Promise<void>
}

export type TenantSelectorPropsBase = {
  currentTenantId: TenantId
  className?: string
}

export type TenantSelectorProps =
  | (TenantSelectorPropsBase & {
      viewOnly: true
    })
  | (TenantSelectorPropsBase & {
      viewOnly?: false
      availableTenantIds: TenantId[]
      onServerChange: (tenantId: TenantId) => void
    })

export type TenantSelectorInteractiveProps = TenantSelectorPropsBase & {
  viewOnly?: false
  availableTenantIds: TenantId[]
  onServerChange: (tenantId: TenantId) => void
}
