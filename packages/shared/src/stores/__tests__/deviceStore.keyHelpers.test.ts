import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { describe, expect, it } from "vitest";
import {
  isHashedSecretKey,
  reconstructPublicKey,
  resolveStoredSecretKey,
} from "#/stores/deviceStore/keyHelpers";
import { KEY_FLAG_ED25519, KEY_FLAG_SECP256R1 } from "#/types/stores";

describe("isHashedSecretKey", () => {
  it("returns true for object with string iv and data", () => {
    expect(isHashedSecretKey({ iv: "a", data: "b", salt: "c" })).toBe(true);
    expect(isHashedSecretKey({ iv: "", data: "" })).toBe(true);
  });

  it("returns false for non-objects and null", () => {
    expect(isHashedSecretKey(null)).toBe(false);
    expect(isHashedSecretKey(undefined)).toBe(false);
    expect(isHashedSecretKey("x")).toBe(false);
    expect(isHashedSecretKey(1)).toBe(false);
  });

  it("returns false when iv or data is missing or not a string", () => {
    expect(isHashedSecretKey({})).toBe(false);
    expect(isHashedSecretKey({ iv: "a" })).toBe(false);
    expect(isHashedSecretKey({ data: "b" })).toBe(false);
    expect(isHashedSecretKey({ iv: 1, data: "b" })).toBe(false);
    expect(isHashedSecretKey({ iv: "a", data: 2 })).toBe(false);
  });
});

describe("resolveStoredSecretKey", () => {
  it("returns null for falsy input", async () => {
    await expect(resolveStoredSecretKey(null, "pin")).resolves.toBeNull();
    await expect(resolveStoredSecretKey(undefined, "pin")).resolves.toBeNull();
    await expect(resolveStoredSecretKey("", "pin")).resolves.toBeNull();
  });

  it("returns the same object when already hashed shape", async () => {
    const hashed = { iv: "i", data: "d", salt: "s" };
    await expect(resolveStoredSecretKey(hashed, "pin")).resolves.toBe(hashed);
  });

  it("encrypts plain string secrets", async () => {
    const result = await resolveStoredSecretKey("raw-secret", "1234");
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: expect.any(String),
    });
  });

  it("returns null for unsupported value types", async () => {
    await expect(resolveStoredSecretKey(42, "pin")).resolves.toBeNull();
    await expect(
      resolveStoredSecretKey({ foo: "bar" }, "pin"),
    ).resolves.toBeNull();
  });
});

describe("reconstructPublicKey", () => {
  it("reconstructs Ed25519 when flag is KEY_FLAG_ED25519", () => {
    const kp = Ed25519Keypair.generate();
    const pub = kp.getPublicKey();
    const bytes = Array.from(pub.toRawBytes());
    const out = reconstructPublicKey(bytes, KEY_FLAG_ED25519);
    expect(out).not.toBeNull();
    expect(out?.toRawBytes()).toEqual(pub.toRawBytes());
  });

  it("reconstructs Secp256r1 when flag is KEY_FLAG_SECP256R1", () => {
    const kp = Secp256r1Keypair.generate();
    const pub = kp.getPublicKey();
    const bytes = Array.from(pub.toRawBytes());
    const out = reconstructPublicKey(bytes, KEY_FLAG_SECP256R1);
    expect(out).not.toBeNull();
    expect(out?.toRawBytes()).toEqual(pub.toRawBytes());
  });

  it("uses jsdom web default (Secp256r1) when flag is null", () => {
    const kp = Secp256r1Keypair.generate();
    const pub = kp.getPublicKey();
    const bytes = Array.from(pub.toRawBytes());
    const out = reconstructPublicKey(bytes, null);
    expect(out).not.toBeNull();
    expect(out?.toRawBytes()).toEqual(pub.toRawBytes());
  });

  it("returns null for invalid key material", () => {
    const out = reconstructPublicKey([0, 1, 2], KEY_FLAG_ED25519);
    expect(out).toBeNull();
  });
});
