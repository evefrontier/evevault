/**
 * File-based route paths (web + extension).
 * Single source of truth: when adding a new route, add it here and to the app's route tree.
 */
export const FILE_ROUTE_PATHS = [
  "/",
  "/callback",
  "/not-found",
  "/wallet",
  "/wallet/add-token",
  "/wallet/send-token",
  "/wallet/transactions",
] as const;

export type RoutePath = (typeof FILE_ROUTE_PATHS)[number];
export type NavPath = RoutePath | "/tokens" | "/assets" | "/history";

/**
 * Extension route paths
 * These are the routes available in the browser extension popup
 */
export const EXTENSION_ROUTES = {
  HOME: "/",
  ADD_TOKEN: "/add-token",
  SEND_TOKEN: "/send-token",
  TRANSACTIONS: "/transactions",
} as const;

/**
 * Web app route paths
 * These are the routes available in the web application
 */
export const WEB_ROUTES = {
  HOME: "/",
  CALLBACK: "/callback",
  NOT_FOUND: "/not-found",
  WALLET: "/wallet",
  WALLET_ADD_TOKEN: "/wallet/add-token",
  WALLET_SEND_TOKEN: "/wallet/send-token",
  WALLET_TRANSACTIONS: "/wallet/transactions",
} as const;

export type WebRoute = (typeof WEB_ROUTES)[keyof typeof WEB_ROUTES];

const WEB_ROUTE_VALUES: readonly WebRoute[] = Object.values(WEB_ROUTES);

/**
 * Maps a route path (web or extension format) to a web app route.
 * Extension paths like /add-token are converted to /wallet/add-token.
 */
export function toWebRoute(path: string): WebRoute {
  if (path === EXTENSION_ROUTES.ADD_TOKEN) return WEB_ROUTES.WALLET_ADD_TOKEN;
  if (path === EXTENSION_ROUTES.SEND_TOKEN) return WEB_ROUTES.WALLET_SEND_TOKEN;
  if (path === EXTENSION_ROUTES.TRANSACTIONS)
    return WEB_ROUTES.WALLET_TRANSACTIONS;
  if (WEB_ROUTE_VALUES.includes(path as WebRoute)) return path as WebRoute;
  return WEB_ROUTES.WALLET;
}

/** All valid route paths from the router (for web app) */
export const ROUTE_PATHS: readonly NavPath[] = [
  ...FILE_ROUTE_PATHS,
  "/tokens",
  "/assets",
  "/history",
];

/** Navigation items for the sidebar/bottom bar */
export const NAV_ITEMS: readonly {
  name: string;
  path: NavPath;
  icon: string;
  label: string;
}[] = [
  { name: "tokens", path: "/wallet", icon: "Tokens", label: "Tokens" },
  { name: "assets", path: "/wallet", icon: "Assets", label: "Assets" },
  { name: "history", path: "/wallet", icon: "History", label: "History" },
] as const;
