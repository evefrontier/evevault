import { describe, expect, it } from "vitest";
import { AES_IV_LENGTH, PBKDF2_SALT_LENGTH } from "./constants";
import { decrypt } from "./decrypt";
import { encrypt } from "./encrypt";

describe("encrypt", () => {
  it("returns an object with iv, data, and salt fields", async () => {
    const result = await encrypt("my secret", "mypin");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("salt");
    // All fields should be non-empty base64 strings
    expect(result.iv.length).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);
  });

  it("returns base64-encoded iv, data, and salt", async () => {
    const result = await encrypt("my secret", "mypin");
    // Should be valid base64
    expect(() => atob(result.iv)).not.toThrow();
    expect(() => atob(result.data)).not.toThrow();
    expect(() => atob(result.salt)).not.toThrow();
  });

  it("generates a 12-byte iv", async () => {
    const result = await encrypt("test", "pin");
    const ivBytes = Uint8Array.from(atob(result.iv), (c) => c.charCodeAt(0));
    expect(ivBytes.length).toBe(AES_IV_LENGTH);
  });

  it("generates a 16-byte salt", async () => {
    const result = await encrypt("test", "pin");
    const saltBytes = Uint8Array.from(atob(result.salt), (c) =>
      c.charCodeAt(0),
    );
    expect(saltBytes.length).toBe(PBKDF2_SALT_LENGTH);
  });

  it("produces different ciphertext for same input (random iv/salt)", async () => {
    const result1 = await encrypt("same message", "same pin");
    const result2 = await encrypt("same message", "same pin");
    // Due to random IV and salt, outputs should differ
    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.data).not.toBe(result2.data);
  });
});

describe("decrypt with PBKDF2 (new format with salt)", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const plaintext = "super secret key material";
    const pin = "123456";

    const encrypted = await encrypt(plaintext, pin);
    const decrypted = await decrypt(encrypted, pin);

    expect(decrypted).toBe(plaintext);
  });

  it("decrypts with correct pin", async () => {
    const encrypted = await encrypt("hello vault", "correct-pin");
    const result = await decrypt(encrypted, "correct-pin");
    expect(result).toBe("hello vault");
  });

  it("fails to decrypt with incorrect pin", async () => {
    const encrypted = await encrypt("hello vault", "correct-pin");
    await expect(decrypt(encrypted, "wrong-pin")).rejects.toThrow();
  });

  it("preserves unicode content", async () => {
    const unicode = "🔐 secure 日本語 данные";
    const encrypted = await encrypt(unicode, "pin");
    const decrypted = await decrypt(encrypted, "pin");
    expect(decrypted).toBe(unicode);
  });

  it("round-trips empty string", async () => {
    const encrypted = await encrypt("", "pin");
    const decrypted = await decrypt(encrypted, "pin");
    expect(decrypted).toBe("");
  });
});

describe("decrypt legacy format (SHA-256, no salt - backward compatibility)", () => {
  it("decrypts data encrypted with old SHA-256 key derivation", async () => {
    // Simulate old-format encryption (SHA-256 directly, no salt field)
    const pin = "legacypin";
    const plaintext = "old encrypted secret";

    const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;

    // Reproduce the old encrypt logic
    const encoder = new TextEncoder();
    const keyMaterial = await cryptoApi.subtle.digest(
      "SHA-256",
      encoder.encode(pin),
    );
    const aesKey = await cryptoApi.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const iv = new Uint8Array(12);
    cryptoApi.getRandomValues(iv);
    const encryptedData = await cryptoApi.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoder.encode(plaintext),
    );

    const legacyEncrypted = {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
      // No salt field - this is the legacy format
    };

    const decrypted = await decrypt(legacyEncrypted, pin);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt legacy data with wrong pin", async () => {
    const pin = "correctpin";
    const plaintext = "legacy secret";

    const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;
    const encoder = new TextEncoder();
    const keyMaterial = await cryptoApi.subtle.digest(
      "SHA-256",
      encoder.encode(pin),
    );
    const aesKey = await cryptoApi.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const iv = new Uint8Array(12);
    cryptoApi.getRandomValues(iv);
    const encryptedData = await cryptoApi.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoder.encode(plaintext),
    );

    const legacyEncrypted = {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
    };

    await expect(decrypt(legacyEncrypted, "wrongpin")).rejects.toThrow();
  });
});
