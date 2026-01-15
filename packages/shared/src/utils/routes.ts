import type { NavPath } from "../types";

/** All valid route paths from the router */
export const ROUTE_PATHS = [
  "/",
  "/callback",
  "/not-found",
  "/wallet",
  "/wallet/add-token",
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
