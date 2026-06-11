import { decodeJwt, type JWTPayload } from 'jose'

/** Decode a token while tolerating opaque, malformed, or absent values. */
export const decodeJwtSafely = <Claims extends JWTPayload = JWTPayload>(
  token?: string,
): Claims | null => {
  if (!token) return null
  try {
    return decodeJwt<Claims>(token)
  } catch {
    return null
  }
}
