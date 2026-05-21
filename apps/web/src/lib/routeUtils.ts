import type { RoutePath } from '@evevault/shared/types'
import { FILE_ROUTE_PATHS } from '@evevault/shared/utils'

export const getOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export type IndexSearch = {
  redirect?: string
}

export const validateSearch = (
  search: Record<string, unknown>,
): IndexSearch => ({
  redirect: getOptionalString(search.redirect),
})

export const isRoutePath = (value: string): value is RoutePath =>
  (FILE_ROUTE_PATHS as readonly string[]).includes(value)

export const resolveRoute = (target?: string): RoutePath =>
  target && isRoutePath(target) ? target : '/wallet'
