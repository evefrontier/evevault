/**
 * Shared definition of "OAuth token material" — the field names that carry
 * access/identity/refresh tokens and must never cross to a web page.
 *
 * One source of truth, used by two independent layers:
 *  - the extension's sendToTab() choke point (egress at the source), and
 *  - the content script's forwardToPage() filter (egress at the boundary).
 */

export type TokenMaterialField =
  | 'token'
  | 'access_token'
  | 'id_token'
  | 'refresh_token'
  | 'refresh_token_id'

export const TOKEN_MATERIAL_FIELDS: ReadonlySet<string> = new Set<string>([
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'refresh_token_id',
])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value)
  )
}

/**
 * Returns false if `value` contains any OAuth token material at any depth.
 * Arrays and nested objects are inspected recursively.
 */
export function hasNoTokenMaterial(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasNoTokenMaterial)
  if (!isPlainRecord(value)) return true

  return Object.entries(value).every(
    ([field, child]) =>
      !TOKEN_MATERIAL_FIELDS.has(field) && hasNoTokenMaterial(child),
  )
}
