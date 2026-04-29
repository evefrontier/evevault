import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _handleLocalnetGetAddress,
  _handleLocalnetSetKeypair,
  _handleLocalnetSignBytes,
} from "@/lib/background/handlers/localVaultHandlers";
import type { VaultMessage } from "@/lib/background/types";

const { mockSendToKeeper } = vi.hoisted(() => ({
  mockSendToKeeper: vi.fn(),
}));

vi.mock("@/lib/background/handlers/vaultHandlers", () => ({
  sendToKeeper: mockSendToKeeper,
}));

vi.mock("@evevault/shared", () => ({
  LOCALNET_STORAGE_KEY: "evevault:localnet-key",
}));

vi.mock("@evevault/shared/types", () => ({
  KeeperMessageTypes: {
    LOCALNET_SET_KEYPAIR: "LOCALNET_SET_KEYPAIR",
    LOCALNET_GET_ADDRESS: "LOCALNET_GET_ADDRESS",
    LOCALNET_SIGN: "LOCALNET_SIGN",
  },
}));

const mockSender = {} as chrome.runtime.MessageSender;

function makeMessage(overrides: Partial<VaultMessage> = {}): VaultMessage {
  return {
    type: "LOCALNET_SET_KEYPAIR",
    ...overrides,
  } as unknown as VaultMessage;
}

function installChromeMock() {
  globalThis.chrome = {
    storage: {
      local: {
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
  } as unknown as typeof chrome;
}

describe("_handleLocalnetSetKeypair", () => {
  beforeEach(() => {
    installChromeMock();
    mockSendToKeeper.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists key and calls sendResponse when keeper returns ok", async () => {
    mockSendToKeeper.mockResolvedValue({ ok: true, address: "0xabc" });
    const sendResponse = vi.fn();
    const message = makeMessage({
      privateKey: "suiprivkey1abc",
    } as Partial<VaultMessage>);

    _handleLocalnetSetKeypair(message, mockSender, sendResponse);

    // Wait for async IIFE
    await new Promise((r) => setTimeout(r, 0));

    expect(mockSendToKeeper).toHaveBeenCalledWith({
      type: "LOCALNET_SET_KEYPAIR",
      privateKey: "suiprivkey1abc",
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      "evevault:localnet-key": "suiprivkey1abc",
    });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, address: "0xabc" });
  });

  it("does not persist key when keeper returns an error", async () => {
    mockSendToKeeper.mockResolvedValue({ ok: false, error: "Invalid key" });
    const sendResponse = vi.fn();
    const message = makeMessage({
      privateKey: "badkey",
    } as Partial<VaultMessage>);

    _handleLocalnetSetKeypair(message, mockSender, sendResponse);
    await new Promise((r) => setTimeout(r, 0));

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Invalid key",
    });
  });

  it("calls sendResponse with error when sendToKeeper throws", async () => {
    mockSendToKeeper.mockRejectedValue(new Error("Keeper unavailable"));
    const sendResponse = vi.fn();
    const message = makeMessage({
      privateKey: "suiprivkey1abc",
    } as Partial<VaultMessage>);

    _handleLocalnetSetKeypair(message, mockSender, sendResponse);
    await new Promise((r) => setTimeout(r, 0));

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Keeper unavailable",
    });
  });

  it("returns true (async channel indicator)", () => {
    mockSendToKeeper.mockResolvedValue({ ok: true, address: "0xabc" });
    const result = _handleLocalnetSetKeypair(
      makeMessage(),
      mockSender,
      vi.fn(),
    );
    expect(result).toBe(true);
  });
});

describe("_handleLocalnetGetAddress", () => {
  beforeEach(() => {
    installChromeMock();
    mockSendToKeeper.mockReset();
  });

  it("calls sendResponse with keeper address on success", async () => {
    mockSendToKeeper.mockResolvedValue({ ok: true, address: "0xdef" });
    const sendResponse = vi.fn();

    await _handleLocalnetGetAddress(makeMessage(), mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, address: "0xdef" });
  });

  it("calls sendResponse with null address when no keypair loaded", async () => {
    mockSendToKeeper.mockResolvedValue({ ok: true, address: null });
    const sendResponse = vi.fn();

    await _handleLocalnetGetAddress(makeMessage(), mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, address: null });
  });

  it("calls sendResponse with error shape when sendToKeeper throws", async () => {
    mockSendToKeeper.mockRejectedValue(new Error("Keeper error"));
    const sendResponse = vi.fn();

    await _handleLocalnetGetAddress(makeMessage(), mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: false, address: null });
  });
});

describe("_handleLocalnetSignBytes", () => {
  beforeEach(() => {
    installChromeMock();
    mockSendToKeeper.mockReset();
  });

  it("calls sendResponse with bytes and signature on success", async () => {
    mockSendToKeeper.mockResolvedValue({
      ok: true,
      bytes: "base64bytes",
      signature: "base64sig",
    });
    const sendResponse = vi.fn();
    const message = makeMessage({
      msgBytes: [1, 2, 3],
      scope: "TransactionData",
      suiAddress: "0xabc",
    } as Partial<VaultMessage>);

    await _handleLocalnetSignBytes(message, mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      bytes: "base64bytes",
      signature: "base64sig",
    });
  });

  it("converts Uint8Array msgBytes to plain array before sending to keeper", async () => {
    mockSendToKeeper.mockResolvedValue({
      ok: true,
      bytes: "b",
      signature: "s",
    });
    const message = makeMessage({
      msgBytes: new Uint8Array([10, 20, 30]) as unknown as number[],
      scope: "TransactionData",
      suiAddress: "0xabc",
    } as Partial<VaultMessage>);

    await _handleLocalnetSignBytes(message, mockSender, vi.fn());

    const calledWith = mockSendToKeeper.mock.calls[0][0];
    expect(calledWith.msgBytes).toEqual([10, 20, 30]);
  });

  it("calls sendResponse with error when keeper returns ok: false", async () => {
    mockSendToKeeper.mockResolvedValue({
      ok: false,
      error: "No keypair loaded",
    });
    const sendResponse = vi.fn();
    const message = makeMessage({
      msgBytes: [1, 2, 3],
      scope: "TransactionData",
      suiAddress: "0xabc",
    } as Partial<VaultMessage>);

    await _handleLocalnetSignBytes(message, mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "No keypair loaded",
    });
  });

  it("calls sendResponse with error when sendToKeeper throws", async () => {
    mockSendToKeeper.mockRejectedValue(new Error("Keeper crashed"));
    const sendResponse = vi.fn();
    const message = makeMessage({
      msgBytes: [1, 2, 3],
      scope: "TransactionData",
      suiAddress: "0xabc",
    } as Partial<VaultMessage>);

    await _handleLocalnetSignBytes(message, mockSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Keeper crashed",
    });
  });
});
