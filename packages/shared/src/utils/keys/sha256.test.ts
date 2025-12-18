import { describe, expect, it } from "vitest";
import { sha256, sha256Hex } from "./sha256";

describe("sha256", () => {
  it("returns ArrayBuffer-like object for string input", async () => {
    const result = await sha256("test");
    // jsdom's crypto returns ArrayBuffer-like object, check for byteLength property
    expect(result).toHaveProperty("byteLength");
    expect(typeof result.byteLength).toBe("number");
  });

  it("produces consistent hashes for same input", async () => {
    const hash1 = await sha256("hello world");
    const hash2 = await sha256("hello world");

    const bytes1 = new Uint8Array(hash1);
    const bytes2 = new Uint8Array(hash2);

    expect(bytes1).toEqual(bytes2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256("input1");
    const hash2 = await sha256("input2");

    const bytes1 = new Uint8Array(hash1);
    const bytes2 = new Uint8Array(hash2);

    expect(bytes1).not.toEqual(bytes2);
  });

  it("produces 32-byte (256-bit) output", async () => {
    const result = await sha256("any input");
    expect(result.byteLength).toBe(32);
  });
});

describe("sha256Hex", () => {
  it("returns 64-character hex string", async () => {
    const result = await sha256Hex("test");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("produces known hash for test vector", async () => {
    // SHA-256 of empty string is a well-known test vector
    const emptyHash = await sha256Hex("");
    expect(emptyHash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );

    // SHA-256 of "hello" is another known test vector
    const helloHash = await sha256Hex("hello");
    expect(helloHash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("is consistent with sha256 output", async () => {
    const input = "test input";
    const arrayBuffer = await sha256(input);
    const hexString = await sha256Hex(input);

    // Convert ArrayBuffer to hex manually
    const bytes = new Uint8Array(arrayBuffer);
    const manualHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(hexString).toBe(manualHex);
  });

  it("produces consistent hashes for same input", async () => {
    const hash1 = await sha256Hex("same input");
    const hash2 = await sha256Hex("same input");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256Hex("input1");
    const hash2 = await sha256Hex("input2");
    expect(hash1).not.toBe(hash2);
  });
});
