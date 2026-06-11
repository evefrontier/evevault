import type { HashedData } from '#/types/stores'
import { b64ToBytes } from '../base64'
import { deriveAesKey } from './encrypt'

export async function decrypt(encryptedKey: HashedData, pin: string) {
  const cryptoApi =
    typeof crypto !== 'undefined' ? crypto : (window as Window).crypto

  const salt = b64ToBytes(encryptedKey.salt)
  const aesKey = await deriveAesKey(pin, salt, ['decrypt'])

  const iv = b64ToBytes(encryptedKey.iv)
  const encryptedData = b64ToBytes(encryptedKey.data)

  const decryptedData = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedData,
  )

  return new TextDecoder().decode(decryptedData)
}
