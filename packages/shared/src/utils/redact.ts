import { TOKEN_MATERIAL_FIELDS } from './tokenMaterial'

/**
 * Field names whose values must never appear in logs/telemetry. Superset of
 * TOKEN_MATERIAL_FIELDS, extended with vault, key, proof, and signing secrets.
 * Used by redactSensitive() to sanitize payloads before logging.
 */
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set<string>([
  ...TOKEN_MATERIAL_FIELDS,
  'pin',
  'hashedSecretKey',
  'secretKey',
  'privateKey',
  'private_key',
  'mnemonic',
  'seed',
  'zkProof',
  'proof',
  'signature',
  'userSignature',
  'jwt',
  'salt',
  'msgBytes',
])

export const REDACTED = '[REDACTED]'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Returns a deep copy of `value` with the values of any sensitive fields
 * replaced by '[REDACTED]'. Arrays and nested objects are sanitized
 * recursively; primitives pass through unchanged. Use this to sanitize
 * unknown/dynamic payloads before logging them.
 */
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (!isPlainRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) =>
      SENSITIVE_FIELDS.has(key)
        ? [key, REDACTED]
        : [key, redactSensitive(child)],
    ),
  )
}
