import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetExtendedEphemeralPublicKey } = vi.hoisted(() => ({
  mockGetExtendedEphemeralPublicKey: vi.fn(),
}));

vi.mock("@mysten/sui/zklogin", () => ({
  getExtendedEphemeralPublicKey: (...args: unknown[]) =>
    mockGetExtendedEphemeralPublicKey(...args),
}));

vi.mock("#/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { fetchZkProof } from "#/wallet/zkProof";

describe("fetchZkProof", () => {
  const proofResponse = {
    data: {
      proofPoints: {
        a: ["1", "2"],
        b: [
          ["3", "4"],
          ["5", "6"],
        ],
        c: ["7", "8"],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExtendedEphemeralPublicKey.mockReturnValue("extended-public-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a proof request to Enoki with the expected headers and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(proofResponse),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchZkProof({
        jwtRandomness: "randomness",
        maxEpoch: "12",
        ephemeralPublicKey: "ephemeral-public-key" as never,
        idToken: "id-token",
        enokiApiKey: "enoki-api-key",
        network: "testnet",
      }),
    ).resolves.toBe(proofResponse);

    expect(mockGetExtendedEphemeralPublicKey).toHaveBeenCalledWith(
      "ephemeral-public-key",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.enoki.mystenlabs.com/v1/zklogin/zkp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "enoki-api-key",
          "zklogin-jwt": "id-token",
        },
        body: JSON.stringify({
          network: "testnet",
          ephemeralPublicKey: "extended-public-key",
          maxEpoch: 12,
          randomness: "randomness",
        }),
      },
    );
  });

  it("defaults network to devnet when omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(proofResponse),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchZkProof({
      jwtRandomness: "randomness",
      maxEpoch: 9,
      ephemeralPublicKey: "ephemeral-public-key" as never,
      idToken: "id-token",
      enokiApiKey: "enoki-api-key",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      network: "devnet",
      maxEpoch: 9,
    });
  });

  it("throws when Enoki returns a non-OK response with a JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: vi.fn().mockResolvedValue({ message: "bad request" }),
      }),
    );

    await expect(
      fetchZkProof({
        jwtRandomness: "randomness",
        maxEpoch: 12,
        ephemeralPublicKey: "ephemeral-public-key" as never,
        idToken: "id-token",
        enokiApiKey: "enoki-api-key",
      }),
    ).rejects.toThrow("Failed to fetch ZK proof");
  });

  it("throws when Enoki returns a non-OK response with a non-JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: vi.fn().mockRejectedValue(new Error("not json")),
      }),
    );

    await expect(
      fetchZkProof({
        jwtRandomness: "randomness",
        maxEpoch: 12,
        ephemeralPublicKey: "ephemeral-public-key" as never,
        idToken: "id-token",
        enokiApiKey: "enoki-api-key",
      }),
    ).rejects.toThrow("Failed to fetch ZK proof");
  });
});
