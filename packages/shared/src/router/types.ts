/**
 * Router-related type definitions shared across apps.
 */

export type RouteMetaWithTitle = {
  title: string;
};

/**
 * Search params for the send-token route.
 * Used by both web and extension apps.
 */
export interface SendTokenSearch {
  coinType: string;
}
