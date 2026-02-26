import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard, formatAddress } from "../address";

describe("formatAddress", () => {
  describe("basic formatting", () => {
    it("formats a long address with default parameters", () => {
      const address = "0x1234567890abcdef1234567890abcdef";
      const result = formatAddress(address);
      expect(result).toBe("0x1234•••abcdef");
    });

    it("formats with custom prefix and suffix lengths", () => {
      const address = "0x1234567890abcdef1234567890abcdef";
      const result = formatAddress(address, 4, 4);
      expect(result).toBe("0x12•••cdef");
    });

    it("formats with different custom lengths", () => {
      const address = "0x1234567890abcdef1234567890abcdef";
      const result = formatAddress(address, 8, 8);
      expect(result).toBe("0x123456•••0abcdef");
    });
  });

  describe("edge cases", () => {
    it("returns original address if shorter than prefix + suffix", () => {
      const shortAddress = "0x123456";
      const result = formatAddress(shortAddress, 6, 6);
      expect(result).toBe("0x123456");
    });

    it("returns original address if equal to prefix + suffix", () => {
      const address = "0x12345678";
      const result = formatAddress(address, 4, 4);
      expect(result).toBe("0x12345678");
    });

    it("returns empty string for empty input", () => {
      const result = formatAddress("");
      expect(result).toBe("");
    });

    it("handles null-like values gracefully", () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      const result = formatAddress(null);
      expect(result).toBe(null);
    });

    it("handles undefined gracefully", () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      const result = formatAddress(undefined);
      expect(result).toBe(undefined);
    });
  });

  describe("special characters", () => {
    it("preserves special characters in address", () => {
      const address = "0xABCD!@#$%^&*()1234567890";
      const result = formatAddress(address, 6, 6);
      expect(result).toBe("0xABCD•••567890");
    });
  });
});

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful copy", () => {
    it("returns true when clipboard API is available and copy succeeds", async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("test text");

      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith("test text");
    });

    it("copies different text values", async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      await copyToClipboard("0x1234567890abcdef");
      expect(mockWriteText).toHaveBeenCalledWith("0x1234567890abcdef");

      await copyToClipboard("different text");
      expect(mockWriteText).toHaveBeenCalledWith("different text");
    });
  });

  describe("error handling", () => {
    it("returns false when clipboard API is not available", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("test text");
      expect(result).toBe(false);
    });

    it("returns false when clipboard writeText fails", async () => {
      const mockWriteText = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("test text");
      expect(result).toBe(false);
    });

    it("handles empty string", async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("");
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith("");
    });
  });
});
