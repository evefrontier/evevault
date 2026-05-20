import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockIsBrowser = vi.hoisted(() => vi.fn(() => true));

vi.mock("#/utils", () => ({
  isBrowser: () => mockIsBrowser(),
}));

import {
  getEnokiApiKey,
  getErrorMessage,
} from "#/auth/stores/authWorkflowUtils";

describe("getEnokiApiKey", () => {
  beforeEach(() => {
    mockIsBrowser.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("getEnokiApiKey() when isBrowser() is true and env exists", () => {
    vi.stubEnv("VITE_ENOKI_API_KEY", "test-enoki-key");
    expect(getEnokiApiKey()).toBe("test-enoki-key");
  });

  it("getEnokiApiKey() when browser env is missing", () => {
    vi.stubEnv("VITE_ENOKI_API_KEY", undefined);
    expect(getEnokiApiKey()).toBe("");
  });

  it("getEnokiApiKey() when isBrowser() is false, reading process.env", () => {
    mockIsBrowser.mockReturnValue(false);
    vi.stubGlobal("process", { env: { VITE_ENOKI_API_KEY: "node-key" } });

    expect(getEnokiApiKey()).toBe("node-key");
  });
});

describe("getErrorMessage", () => {
  it("getErrorMessage(new Error('x')) === 'x'", () => {
    expect(getErrorMessage(new Error("x"))).toBe("x");
  });

  it("getErrorMessage('x') === 'Unknown error'", () => {
    expect(getErrorMessage("x")).toBe("Unknown error");
  });
});
