import type { SuiChain } from "@mysten/wallet-standard";

export const getDeviceData = async (chain: SuiChain) => {
  // Lazy import to avoid circular dependency: utils → getters → deviceStore → auth → authStore → utils
  const { useDeviceStore } = await import("../stores/deviceStore");
  const deviceStore = useDeviceStore.getState();

  // Check if store has all required data
  const jwtRandomness = deviceStore.jwtRandomness;
  const nonce = deviceStore.getNonce(chain);
  const maxEpoch = deviceStore.getMaxEpoch(chain);

  // console.log("from device store", {
  //   jwtRandomness,
  //   nonce,
  //   maxEpoch,
  // });

  // // If store has all data, return it immediately (avoid storage read)
  // if (jwtRandomness && nonce && maxEpoch) {
  //   return {
  //     jwtRandomness,
  //     nonce,
  //     maxEpoch,
  //   };
  // }

  // Fallback: read from storage only if store is missing data
  const result = await chrome.storage.local.get(["evevault:device"]);
  const parsedResult = JSON.parse(result["evevault:device"] as string).state;
  const networkData = parsedResult.networkData[chain];

  return {
    jwtRandomness: jwtRandomness ?? parsedResult.jwtRandomness,
    nonce: nonce ?? networkData.nonce,
    maxEpoch: maxEpoch ?? networkData.maxEpoch,
  };
};
