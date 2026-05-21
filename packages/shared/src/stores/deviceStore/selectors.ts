import type { SuiChain } from '@mysten/wallet-standard';
import type { DeviceState } from '#/types';
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks';

export function createDeviceSelectors(get: () => DeviceState) {
  return {
    getMaxEpoch: (chain: SuiChain) => {
      if (isLocalnetChain(chain)) return get().localnet.maxEpoch;
      if (!isZkLoginSuiChain(chain)) return null;
      return get().networkData[chain]?.maxEpoch ?? null;
    },

    getMaxEpochTimestampMs: (chain: SuiChain) => {
      if (isLocalnetChain(chain)) return get().localnet.maxEpochTimestampMs;
      if (!isZkLoginSuiChain(chain)) return null;
      return get().networkData[chain]?.maxEpochTimestampMs ?? null;
    },

    getNonce: (chain: SuiChain) => {
      if (!isZkLoginSuiChain(chain)) return null;
      return get().networkData[chain]?.nonce ?? null;
    },

    getJwtRandomness: (chain: SuiChain) => {
      if (!isZkLoginSuiChain(chain)) return null;
      return get().networkData[chain]?.jwtRandomness ?? null;
    },
  };
}
