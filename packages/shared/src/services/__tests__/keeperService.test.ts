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
