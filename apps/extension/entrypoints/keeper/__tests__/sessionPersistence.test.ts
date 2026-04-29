/// <reference types="chrome"/>

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPersistedKeeperState,
  persistKeeperState,
  restoreKeeperState,
} from "../sessionPersistence";

// Minimal in-memory mock of chrome.storage.session for vitest.
function makeSessionStorageMock() {
  const store = new Map<string, unknown>();
  return {
    async get(key?: string | string[]) {
      if (typeof key === "string") {
        return store.has(key) ? { [key]: store.get(key) } : {};
      }
      const result: Record<string, unknown> = {};
      for (const [k, v] of store.entries()) result[k] = v;
      return result;
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(key: string | string[]) {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) store.delete(k);
    },
    _store: store,
  };
}

describe("keeper sessionPersistence", () => {
  let mockSession: ReturnType<typeof makeSessionStorageMock>;

  beforeEach(() => {
    mockSession = makeSessionStorageMock();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: { session: mockSession },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips an ephemeral keypair through persist + restore", async () => {
    const original = Ed25519Keypair.generate();
    const expiry = Date.now() + 5 * 60 * 1000;

    await persistKeeperState(original, expiry);
    const restored = await restoreKeeperState();

    expect(restored).not.toBeNull();
    expect(restored?.unlockExpiry).toBe(expiry);
    expect(restored?.ephemeralKey.getPublicKey().toRawBytes()).toEqual(
      original.getPublicKey().toRawBytes(),
    );
  });

  it("returns null when no state has been persisted", async () => {
    const restored = await restoreKeeperState();
    expect(restored).toBeNull();
  });

  it("returns null and clears storage when persisted state has expired", async () => {
    const original = Ed25519Keypair.generate();
    const expiredAt = Date.now() - 1000;

    await persistKeeperState(original, expiredAt);
    const restored = await restoreKeeperState();

    expect(restored).toBeNull();
    // Storage should now be empty
    const remaining = await mockSession.get();
    expect(remaining).toEqual({});
  });

  it("clearPersistedKeeperState removes the entry", async () => {
    const original = Ed25519Keypair.generate();
    await persistKeeperState(original, Date.now() + 60_000);

    expect((await mockSession.get())["keeper.session.v1"]).toBeDefined();

    await clearPersistedKeeperState();

    expect((await mockSession.get())["keeper.session.v1"]).toBeUndefined();
  });

  it("returns null gracefully when chrome.storage.session is unavailable", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {};
    const restored = await restoreKeeperState();
    expect(restored).toBeNull();
  });

  it("persistKeeperState swallows errors (best-effort)", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        session: {
          set: () => Promise.reject(new Error("quota exceeded")),
          get: () => Promise.resolve({}),
          remove: () => Promise.resolve(),
        },
      },
    };
    // Should not throw
    await expect(
      persistKeeperState(Ed25519Keypair.generate(), Date.now() + 60_000),
    ).resolves.toBeUndefined();
  });
});
