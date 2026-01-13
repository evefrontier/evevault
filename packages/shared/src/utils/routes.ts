import type { NavPath } from "@evevault/shared/types";

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

/** All valid route paths from the router (for web app) */
export const ROUTE_PATHS = [
  "/",
  "/callback",
  "/not-found",
  "/wallet",
  "/wallet/add-token",
  "/wallet/send-token",
  "/wallet/transactions",
  "/tokens",
  "/assets",
  "/history",
] as const satisfies readonly NavPath[];

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
