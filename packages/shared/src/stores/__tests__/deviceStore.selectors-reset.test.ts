import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyNetworkDataEntry,
  useDeviceStore,
  waitForDeviceHydration,
} from "../deviceStore";
import { useNetworkStore } from "../networkStore";

describe("deviceStore selectors", () => {
  beforeEach(() => {
    useNetworkStore.setState({ chain: SUI_TESTNET_CHAIN });
    useDeviceStore.setState({
      isLocked: true,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralPublicKeyFlag: null,
      ephemeralKeyPairSecretKey: null,
      networkData: {
        [SUI_TESTNET_CHAIN]: {
          nonce: "testnet-nonce",
          maxEpoch: "99",
          maxEpochTimestampMs: 42,
          jwtRandomness: "jr-testnet",
        },
        [SUI_DEVNET_CHAIN]: {
          nonce: "devnet-nonce",
          maxEpoch: "1",
          maxEpochTimestampMs: 7,
          jwtRandomness: "jr-devnet",
        },
      },
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    useDeviceStore.persist.clearStorage();
    useDeviceStore.setState(useDeviceStore.getInitialState());
  });

  it("uses current network chain when chain arg is omitted", () => {
    const s = useDeviceStore.getState();
    expect(s.getNonce()).toBe("testnet-nonce");
    expect(s.getMaxEpoch()).toBe("99");
    expect(s.getMaxEpochTimestampMs()).toBe(42);
    expect(s.getJwtRandomness()).toBe("jr-testnet");
  });

  it("uses explicit chain when provided", () => {
    const s = useDeviceStore.getState();
    expect(s.getNonce(SUI_DEVNET_CHAIN)).toBe("devnet-nonce");
    expect(s.getMaxEpoch(SUI_MAINNET_CHAIN)).toBeNull();
  });

  it("returns null when network entry is missing", () => {
    useDeviceStore.setState({
      networkData: {},
    });
    const s = useDeviceStore.getState();
    expect(s.getNonce()).toBeNull();
    expect(s.getMaxEpoch()).toBeNull();
  });
});

describe("deviceStore.reset()", () => {
  beforeEach(() => {
    const pk = new Ed25519PublicKey(new Uint8Array(32).fill(9));
    useDeviceStore.setState({
      isLocked: false,
      ephemeralPublicKey: pk,
      ephemeralPublicKeyBytes: Array.from(pk.toRawBytes()),
      ephemeralPublicKeyFlag: pk.flag(),
      ephemeralKeyPairSecretKey: { iv: "i", data: "d", salt: "s" },
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "dirty",
          maxEpoch: "x",
          maxEpochTimestampMs: 1,
          jwtRandomness: "y",
        },
      },
      loading: true,
      error: "err",
    });
  });

  afterEach(() => {
    useDeviceStore.persist.clearStorage();
    useDeviceStore.setState(useDeviceStore.getInitialState());
  });

  it("clears keys and restores initial network map", () => {
    useDeviceStore.getState().reset();
    const s = useDeviceStore.getState();
    expect(s.isLocked).toBe(true);
    expect(s.ephemeralPublicKey).toBeNull();
    expect(s.ephemeralKeyPairSecretKey).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.networkData[SUI_DEVNET_CHAIN]).toEqual(
      createEmptyNetworkDataEntry(),
    );
    expect(s.networkData[SUI_TESTNET_CHAIN]).toEqual(
      createEmptyNetworkDataEntry(),
    );
  });
});

describe("createEmptyNetworkDataEntry", () => {
  it("returns all-null entry shape", () => {
    expect(createEmptyNetworkDataEntry()).toEqual({
      nonce: null,
      maxEpoch: null,
      maxEpochTimestampMs: null,
      jwtRandomness: null,
    });
  });
});

describe("waitForDeviceHydration", () => {
  it("resolves without throwing", async () => {
    await expect(waitForDeviceHydration()).resolves.toBeUndefined();
  });
});
