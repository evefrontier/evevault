import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JwtResponse } from "../../../types/authTypes";

vi.mock("../../getZkLoginAddress", () => ({
  getZkLoginAddress: vi.fn(),
}));

vi.mock("../../storageService", () => ({
  getJwtForNetwork: vi.fn(),
}));

vi.mock("../../stores/authStore", () => ({
  getEnokiApiKey: vi.fn(() => "test-enoki-key"),
}));

import { getZkLoginAddress } from "../../getZkLoginAddress";
import { getJwtForNetwork } from "../../storageService";
import {
  getUserForNetwork,
  isErrorWithMessage,
  resolveExpiresAt,
} from "../authStoreUtils";

describe("isErrorWithMessage", () => {
  it("returns true for object with string message", () => {
    expect(isErrorWithMessage({ message: "x" })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isErrorWithMessage(null)).toBe(false);
  });

  it("returns false when message is not a string", () => {
    expect(isErrorWithMessage({ message: 1 })).toBe(false);
  });

  it("returns false when message property is missing", () => {
    expect(isErrorWithMessage({})).toBe(false);
  });
});

describe("resolveExpiresAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses expires_at when present", () => {
    expect(
      resolveExpiresAt({
        access_token: "a",
        id_token: "i",
        expires_in: 3600,
        scope: "s",
        token_type: "Bearer",
        expires_at: 1_900_000_000,
      }),
    ).toBe(1_900_000_000);
  });

  it("uses expires_in relative to now when expires_at absent", () => {
    expect(
      resolveExpiresAt({
        access_token: "a",
        id_token: "i",
        expires_in: 120,
        scope: "s",
        token_type: "Bearer",
      }),
    ).toBe(Math.floor(Date.now() / 1000) + 120);
  });

  it("falls back to now when expires_at and expires_in are not usable numbers", () => {
    expect(
      resolveExpiresAt({
        access_token: "a",
        id_token: "i",
        scope: "s",
        token_type: "Bearer",
      } as JwtResponse),
    ).toBe(Math.floor(Date.now() / 1000));
  });
});

describe("getUserForNetwork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no JWT for chain", async () => {
    vi.mocked(getJwtForNetwork).mockResolvedValue(null);
    await expect(getUserForNetwork("sui:testnet")).resolves.toBeNull();
    expect(getZkLoginAddress).not.toHaveBeenCalled();
  });

  it("returns null when JWT has no id_token", async () => {
    vi.mocked(getJwtForNetwork).mockResolvedValue({
      access_token: "a",
      id_token: "",
      expires_in: 3600,
      scope: "s",
      token_type: "Bearer",
    });
    await expect(getUserForNetwork("sui:testnet")).resolves.toBeNull();
    expect(getZkLoginAddress).not.toHaveBeenCalled();
  });

  it("returns null when zkLogin returns error", async () => {
    vi.mocked(getJwtForNetwork).mockResolvedValue({
      access_token: "a",
      id_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      expires_in: 3600,
      scope: "s",
      token_type: "Bearer",
    });
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: undefined,
      error: { message: "enoki failed" },
    });
    await expect(getUserForNetwork("sui:testnet")).resolves.toBeNull();
  });

  it("returns null when zkLogin has no data", async () => {
    vi.mocked(getJwtForNetwork).mockResolvedValue({
      access_token: "a",
      id_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      expires_in: 3600,
      scope: "s",
      token_type: "Bearer",
    });
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: undefined,
      error: undefined,
    });
    await expect(getUserForNetwork("sui:testnet")).resolves.toBeNull();
  });

  it("returns User when zkLogin succeeds", async () => {
    const idToken =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImF1ZCI6ImF1ZDEifQ.sig";
    vi.mocked(getJwtForNetwork).mockResolvedValue({
      access_token: "at",
      id_token: idToken,
      expires_in: 3600,
      scope: "openid",
      token_type: "Bearer",
      expires_at: 2_000_000_000,
    });
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: {
        address: "0xsui",
        salt: "99",
        publicKey: "pk",
      },
      error: undefined,
    });

    const user = await getUserForNetwork("sui:testnet");
    expect(user).not.toBeNull();
    expect(user?.id_token).toBe(idToken);
    expect(user?.profile?.sui_address).toBe("0xsui");
    expect(user?.profile?.salt).toBe("99");
    expect(user?.expires_at).toBe(2_000_000_000);
  });
});
