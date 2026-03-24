import type { SuiChain } from "@mysten/wallet-standard";
import type { DeviceState } from "../../types";
import { useNetworkStore } from "../networkStore";

export function createDeviceSelectors(get: () => DeviceState) {
  return {
    getMaxEpoch: (chain?: SuiChain) => {
      const currentChain = chain || useNetworkStore.getState().chain;
      return get().networkData[currentChain]?.maxEpoch ?? null;
    },

    getMaxEpochTimestampMs: (chain?: SuiChain) => {
      const currentChain = chain || useNetworkStore.getState().chain;
      return get().networkData[currentChain]?.maxEpochTimestampMs ?? null;
    },

    getNonce: (chain?: SuiChain) => {
      const currentChain = chain || useNetworkStore.getState().chain;
      return get().networkData[currentChain]?.nonce ?? null;
    },

    getJwtRandomness: (chain?: SuiChain) => {
      const currentChain = chain || useNetworkStore.getState().chain;
      return get().networkData[currentChain]?.jwtRandomness ?? null;
    },
  };
}
