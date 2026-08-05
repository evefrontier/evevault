import { decodeJwtPayloadSafely } from '@evefrontier/wallet-core/jwt'
import type { JWTPayload } from 'jose'

/** Decode a token while tolerating opaque, malformed, or absent values. */
export const decodeJwtSafely = <Claims extends JWTPayload = JWTPayload>(
  token?: string,
): Claims | null => decodeJwtPayloadSafely<Claims>(token)
