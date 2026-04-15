import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultMessageTypes } from "../../types/messages";
import { ephKeyService } from "../keeperService";

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn();
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
  // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
} as any;

describe("ephKeyService.lock()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends LOCK message to keeper and succeeds when response is ok", async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: true });

    await ephKeyService.lock();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    });
  });

  it("throws error when keeper response is not ok", async () => {
    const errorMessage = "Keeper lock failed";
    mockSendMessage.mockResolvedValueOnce({
      ok: false,
      error: errorMessage,
    });

    await expect(ephKeyService.lock()).rejects.toThrow(errorMessage);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    });
  });

  it("throws error when keeper response is undefined", async () => {
    mockSendMessage.mockResolvedValueOnce(undefined);

    await expect(ephKeyService.lock()).rejects.toThrow("Failed to lock vault");

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: VaultMessageTypes.LOCK,
    });
  });

  it("throws error when keeper response has no error message", async () => {
    mockSendMessage.mockResolvedValueOnce({ ok: false });

    await expect(ephKeyService.lock()).rejects.toThrow("Failed to lock vault");
  });
});

describe("ephKeyService.rotateEphemeralKeyPair()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends ROTATE_KEYPAIR message and returns refreshed key", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        ok: true,
        hashedSecretKey: { iv: "iv", data: "data", salt: "salt" },
      })
      .mockResolvedValueOnce({
        ok: true,
        publicKeyBytes: new Uint8Array(32).fill(7),
      });

    const result = await ephKeyService.rotateEphemeralKeyPair();

    expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
      type: VaultMessageTypes.ROTATE_KEYPAIR,
    });
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
      type: VaultMessageTypes.GET_PUBLIC_KEY,
    });
    expect(result.hashedSecretKey).toEqual({
      iv: "iv",
      data: "data",
      salt: "salt",
    });
    expect(result.publicKey).toBeDefined();
  });
});
