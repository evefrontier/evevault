/**
 * File-based route paths (web + extension).
 * Single source of truth: when adding a new route, add it here and to the app's route tree.
 */
export const FILE_ROUTE_PATHS = [
  '/',
  '/callback',
  '/not-found',
  '/wallet',
  '/wallet/add-token',
  '/wallet/send-token',
  '/wallet/transactions',
  '/wallet/address-aliases',
] as const

export type RoutePath = (typeof FILE_ROUTE_PATHS)[number]
export type NavPath = RoutePath

/**
 * Extension route paths
 * These are the routes available in the browser extension popup
 */
export const EXTENSION_ROUTES = {
  HOME: '/',
  ADD_TOKEN: '/add-token',
  SEND_TOKEN: '/send-token',
  TRANSACTIONS: '/transactions',
  ADDRESS_ALIASES: '/address-aliases',
  LOCALNET_SETTINGS: '/localnet-settings',
} as const

/**
 * Web app route paths
 * These are the routes available in the web application
 */
export const WEB_ROUTES = {
  HOME: '/',
  CALLBACK: '/callback',
  NOT_FOUND: '/not-found',
  WALLET: '/wallet',
  WALLET_ADD_TOKEN: '/wallet/add-token',
  WALLET_SEND_TOKEN: '/wallet/send-token',
  WALLET_TRANSACTIONS: '/wallet/transactions',
  WALLET_ADDRESS_ALIASES: '/wallet/address-aliases',
} as const

/** Navigation items for the sidebar/bottom bar */
export const NAV_ITEMS: readonly {
  name: string
  path: NavPath
  icon: string
  label: string
}[] = [
  { name: 'assets', path: '/wallet', icon: 'Assets', label: 'Home' },
  {
    name: 'history',
    path: '/wallet/transactions',
    icon: 'History',
    label: 'Transactions',
  },
  {
    name: 'address-aliases',
    path: '/wallet/address-aliases',
    icon: 'Tokens',
    label: 'Address Aliases',
  },
] as const
