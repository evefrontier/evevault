import { describe, expect, it } from "vitest";
import { decrypt } from "../decrypt";
import { encrypt } from "../encrypt";

describe("encrypt", () => {
  describe("successful encryption", () => {
    it("encrypts a string with a PIN", async () => {
      const plaintext = "secret data";
      const pin = "123456";

      const result = await encrypt(plaintext, pin);

      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("data");
      expect(typeof result.iv).toBe("string");
      expect(typeof result.data).toBe("string");
      expect(result.iv.length).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("produces different IV for each encryption", async () => {
      const plaintext = "secret data";
      const pin = "123456";

      const result1 = await encrypt(plaintext, pin);
      const result2 = await encrypt(plaintext, pin);

      // IV should be different each time
      expect(result1.iv).not.toBe(result2.iv);
      // But data should be different due to different IV
      expect(result1.data).not.toBe(result2.data);
    });

    it("handles different plaintexts", async () => {
      const pin = "123456";

      const result1 = await encrypt("data1", pin);
      const result2 = await encrypt("data2", pin);

      expect(result1.data).not.toBe(result2.data);
    });

    it("handles different PINs", async () => {
      const plaintext = "secret data";

      const result1 = await encrypt(plaintext, "123456");
      const result2 = await encrypt(plaintext, "654321");

      expect(result1.data).not.toBe(result2.data);
    });

    it("handles empty string", async () => {
      const result = await encrypt("", "123456");

      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("data");
      expect(result.iv.length).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("handles long strings", async () => {
      const longString = "a".repeat(10000);
      const result = await encrypt(longString, "123456");

      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("data");
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("handles special characters", async () => {
      const specialChars = "!@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
      const result = await encrypt(specialChars, "123456");

      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("data");
    });

    it("handles unicode characters", async () => {
      const unicode = "Hello 世界 🌍";
      const result = await encrypt(unicode, "123456");

      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("data");
    });
  });

  describe("IV format", () => {
    it("produces base64-encoded IV", async () => {
      const result = await encrypt("test", "123456");

      // Base64 regex pattern
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(result.iv).toMatch(base64Regex);
    });

    it("produces base64-encoded data", async () => {
      const result = await encrypt("test", "123456");

      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(result.data).toMatch(base64Regex);
    });
  });
});

describe("decrypt", () => {
  describe("successful decryption", () => {
    it("decrypts data encrypted with the same PIN", async () => {
      const plaintext = "secret data";
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);

      expect(decrypted).toBe(plaintext);
    });

    it("decrypts empty string", async () => {
      const plaintext = "";
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);

      expect(decrypted).toBe(plaintext);
    });

    it("decrypts long strings", async () => {
      const plaintext = "a".repeat(10000);
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);

      expect(decrypted).toBe(plaintext);
    });

    it("decrypts special characters", async () => {
      const plaintext = "!@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);

      expect(decrypted).toBe(plaintext);
    });

    it("decrypts unicode characters", async () => {
      const plaintext = "Hello 世界 🌍";
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);

      expect(decrypted).toBe(plaintext);
    });

    it("handles different PINs for different encryptions", async () => {
      const plaintext1 = "data1";
      const plaintext2 = "data2";
      const pin1 = "123456";
      const pin2 = "654321";

      const encrypted1 = await encrypt(plaintext1, pin1);
      const encrypted2 = await encrypt(plaintext2, pin2);

      const decrypted1 = await decrypt(encrypted1, pin1);
      const decrypted2 = await decrypt(encrypted2, pin2);

      expect(decrypted1).toBe(plaintext1);
      expect(decrypted2).toBe(plaintext2);
    });
  });

  describe("error handling", () => {
    it("throws error with wrong PIN", async () => {
      const plaintext = "secret data";
      const correctPin = "123456";
      const wrongPin = "654321";

      const encrypted = await encrypt(plaintext, correctPin);

      await expect(decrypt(encrypted, wrongPin)).rejects.toThrow();
    });

    it("throws error with corrupted data", async () => {
      const pin = "123456";
      const corruptedData = {
        iv: "invalid-iv",
        data: "invalid-data",
      };

      await expect(decrypt(corruptedData, pin)).rejects.toThrow();
    });

    it("throws error with corrupted IV", async () => {
      const plaintext = "secret data";
      const pin = "123456";

      const encrypted = await encrypt(plaintext, pin);
      const corruptedEncrypted = {
        ...encrypted,
        iv: "corrupted",
      };

      await expect(decrypt(corruptedEncrypted, pin)).rejects.toThrow();
    });
  });
});

describe("encrypt/decrypt round-trip", () => {
  it("successfully round-trips multiple times", async () => {
    const plaintext = "secret data";
    const pin = "123456";

    // Encrypt and decrypt multiple times
    for (let i = 0; i < 5; i++) {
      const encrypted = await encrypt(plaintext, pin);
      const decrypted = await decrypt(encrypted, pin);
      expect(decrypted).toBe(plaintext);
    }
  });

  it("maintains data integrity for complex JSON", async () => {
    const complexData = JSON.stringify({
      user: "test@example.com",
      data: {
        nested: {
          value: 123,
          array: [1, 2, 3],
        },
      },
      timestamp: Date.now(),
    });
    const pin = "123456";

    const encrypted = await encrypt(complexData, pin);
    const decrypted = await decrypt(encrypted, pin);

    expect(decrypted).toBe(complexData);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(complexData));
  });
});
