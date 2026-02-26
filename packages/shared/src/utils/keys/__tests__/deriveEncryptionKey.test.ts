import { describe, expect, it } from "vitest";
import { deriveEncryptionKey } from "../deriveEncryptionKey";

describe("deriveEncryptionKey", () => {
  describe("successful key derivation", () => {
    it("derives encryption key from valid JWT token", () => {
      // Create a mock JWT token with sub, tid, and email claims
      const payload = {
        sub: "user-123",
        tid: "tenant-456",
        email: "test@example.com",
        iat: 1234567890,
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const result = deriveEncryptionKey(mockToken);
      
      expect(result).toBe("user-123:tenant-456:test@example.com");
    });

    it("handles different user IDs", () => {
      const payload1 = {
        sub: "user-abc",
        tid: "tenant-xyz",
        email: "alice@example.com",
      };
      const payload2 = {
        sub: "user-def",
        tid: "tenant-xyz",
        email: "bob@example.com",
      };

      const token1 = `header.${btoa(JSON.stringify(payload1))}.signature`;
      const token2 = `header.${btoa(JSON.stringify(payload2))}.signature`;

      const result1 = deriveEncryptionKey(token1);
      const result2 = deriveEncryptionKey(token2);

      expect(result1).toBe("user-abc:tenant-xyz:alice@example.com");
      expect(result2).toBe("user-def:tenant-xyz:bob@example.com");
      expect(result1).not.toBe(result2);
    });

    it("handles special characters in email", () => {
      const payload = {
        sub: "user-123",
        tid: "tenant-456",
        email: "test+tag@sub.example.com",
      };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const result = deriveEncryptionKey(token);
      
      expect(result).toBe("user-123:tenant-456:test+tag@sub.example.com");
    });

    it("produces consistent results for same token", () => {
      const payload = {
        sub: "user-123",
        tid: "tenant-456",
        email: "test@example.com",
      };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const result1 = deriveEncryptionKey(token);
      const result2 = deriveEncryptionKey(token);

      expect(result1).toBe(result2);
    });
  });

  describe("error handling", () => {
    it("throws error for malformed JWT", () => {
      const invalidToken = "not.a.valid.jwt";
      
      expect(() => deriveEncryptionKey(invalidToken)).toThrow(
        "Failed to derive encryption key from token"
      );
    });

    it("throws error for invalid base64 encoding", () => {
      const invalidToken = "header.invalid-base64!@#$.signature";
      
      expect(() => deriveEncryptionKey(invalidToken)).toThrow(
        "Failed to derive encryption key from token"
      );
    });

    it("throws error for missing JWT parts", () => {
      const invalidToken = "only-one-part";
      
      expect(() => deriveEncryptionKey(invalidToken)).toThrow(
        "Failed to derive encryption key from token"
      );
    });

    it("throws error for empty string", () => {
      expect(() => deriveEncryptionKey("")).toThrow(
        "Failed to derive encryption key from token"
      );
    });

    it("throws error for token with invalid JSON payload", () => {
      const invalidPayload = btoa("not valid json {");
      const token = `header.${invalidPayload}.signature`;
      
      expect(() => deriveEncryptionKey(token)).toThrow(
        "Failed to derive encryption key from token"
      );
    });
  });

  describe("edge cases", () => {
    it("handles missing optional claims gracefully", () => {
      const payload = {
        sub: "user-123",
        tid: "tenant-456",
        email: "test@example.com",
        // Other claims omitted
      };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const result = deriveEncryptionKey(token);
      
      expect(result).toBe("user-123:tenant-456:test@example.com");
    });

    it("handles undefined claims values", () => {
      const payload = {
        sub: "user-123",
        tid: undefined,
        email: "test@example.com",
      };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const result = deriveEncryptionKey(token);
      
      expect(result).toBe("user-123:undefined:test@example.com");
    });

    it("handles extra claims in token", () => {
      const payload = {
        sub: "user-123",
        tid: "tenant-456",
        email: "test@example.com",
        iat: 1234567890,
        exp: 9999999999,
        aud: "test-audience",
        iss: "test-issuer",
        extra: "extra-data",
      };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const result = deriveEncryptionKey(token);
      
      // Should only use sub, tid, and email
      expect(result).toBe("user-123:tenant-456:test@example.com");
    });
  });
});
