import type { User } from "oidc-client-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/deviceStore", () => ({
  useDeviceStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/networkStore", () => ({
  useNetworkStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/utils/environment", () => ({
  isWeb: vi.fn(() => true),
  isExtension: vi.fn(() => false),
}));

vi.mock("@/services/vaultService", () => ({
  ephKeyService: {
    getSigner: vi.fn(),
  },
}));

import { ephKeyService } from "@/services/vaultService";
import { useDeviceStore } from "@/stores/deviceStore";
import { useNetworkStore } from "@/stores/networkStore";
import { isWeb } from "@/utils/environment";
import { zkSignAny } from "@/wallet/zkSignAny";

const minimalUser = {
  profile: {
    sui_address: "0x1",
    salt: "1",
    sub: "sub",
    aud: "aud",
  },
} as unknown as User;

describe("zkSignAny error branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWeb).mockReturnValue(true);
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      ephemeralPublicKey: { toRawBytes: () => new Uint8Array([1]) },
      getMaxEpoch: () => "5",
    } as never);
    vi.mocked(useNetworkStore.getState).mockReturnValue({
      chain: "sui:testnet",
    } as never);
  });

  it("throws when user is null", async () => {
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: null as unknown as User,
        getZkProof: vi.fn(),
      }),
    ).rejects.toThrow("User not found");
  });

  it("throws when ephemeral public key is missing", async () => {
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      ephemeralPublicKey: null,
      getMaxEpoch: () => "5",
    } as never);
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ data: {}, error: undefined }),
      }),
    ).rejects.toThrow("Ephemeral key pair not found");
  });

  it("throws when ZK proof is missing", async () => {
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow("Failed to get ZK proof");
  });

  it("throws when ZK proof has string error", async () => {
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ error: "bad proof" }),
      }),
    ).rejects.toThrow("bad proof");
  });

  it("throws when ZK proof has object error with message", async () => {
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi.fn().mockResolvedValue({ error: { message: "nested" } }),
      }),
    ).rejects.toThrow("nested");
  });

  it("throws when max epoch is not set", async () => {
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      ephemeralPublicKey: { toRawBytes: () => new Uint8Array([1]) },
      getMaxEpoch: () => null,
    } as never);
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ data: { x: 1 }, error: undefined }),
      }),
    ).rejects.toThrow("Max epoch is not set");
  });

  it("throws when web vault signer is missing", async () => {
    vi.mocked(ephKeyService.getSigner).mockReturnValue(null);
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ data: { x: 1 }, error: undefined }),
      }),
    ).rejects.toThrow("Vault is locked or no keypair exists");
  });

  it("throws when extension message returns no response", async () => {
    vi.mocked(isWeb).mockReturnValue(false);
    (
      globalThis as unknown as {
        chrome?: { runtime?: { sendMessage?: unknown } };
      }
    ).chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    };
    vi.mocked(ephKeyService.getSigner).mockReturnValue({} as never);
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ data: { x: 1 }, error: undefined }),
      }),
    ).rejects.toThrow("No response from background script");
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("throws when extension message is not ok", async () => {
    vi.mocked(isWeb).mockReturnValue(false);
    (
      globalThis as unknown as {
        chrome?: { runtime?: { sendMessage?: unknown } };
      }
    ).chrome = {
      runtime: {
        sendMessage: vi
          .fn()
          .mockResolvedValue({ ok: false, error: "sign failed" }),
      },
    };
    await expect(
      zkSignAny("PersonalMessage", new Uint8Array([1]), {
        user: minimalUser,
        getZkProof: vi
          .fn()
          .mockResolvedValue({ data: { x: 1 }, error: undefined }),
      }),
    ).rejects.toThrow("sign failed");
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });
});
