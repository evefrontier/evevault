/**
 * Cryptographic constants for key derivation and encryption.
 * Centralized to prevent parameter drift between encrypt() and decrypt().
 */

export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_SALT_LENGTH = 16; // bytes
export const PBKDF2_HASH_ALGORITHM = "SHA-256";
export const AES_KEY_LENGTH = 256; // bits
export const AES_IV_LENGTH = 12; // bytes
