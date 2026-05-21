import {
  AES_IV_LENGTH,
  AES_KEY_LENGTH,
  PBKDF2_HASH_ALGORITHM,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_LENGTH,
} from './constants';

const cryptoApi =
  typeof crypto !== 'undefined' ? crypto : (window as Window).crypto;

/**
 * Derives a non-extractable AES-GCM key from a PIN and salt using PBKDF2.
 * The returned CryptoKey is an opaque browser handle.
 */
export async function deriveAesKey(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH_ALGORITHM,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    usage,
  );
}

export async function encrypt(string: string, pin: string) {
  // Generate a random salt for PBKDF2 key derivation
  const salt = cryptoApi.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH));
  const aesKey = await deriveAesKey(pin, salt, ['encrypt']);

  const iv = cryptoApi.getRandomValues(new Uint8Array(AES_IV_LENGTH));
  const encryptedData = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(string),
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

/**
 * Encrypts using a pre-derived CryptoKey, skipping the PBKDF2 step.
 * The original salt is preserved in the output so that decrypt(result, pin)
 * can re-derive the same key on next unlock.
 */
export async function encryptWithKey(
  string: string,
  key: CryptoKey,
  salt: string,
) {
  const iv = cryptoApi.getRandomValues(new Uint8Array(AES_IV_LENGTH));
  const encryptedData = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(string),
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
    salt,
  };
}
