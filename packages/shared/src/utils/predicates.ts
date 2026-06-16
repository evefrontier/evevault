export const isNonNullable = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
