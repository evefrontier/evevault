import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import type { NetworkDataEntry } from "../../types";

/** Empty network data entry; used for initial state and reset. */
export const createEmptyNetworkDataEntry = (): NetworkDataEntry => ({
  nonce: null,
  maxEpoch: null,
  maxEpochTimestampMs: null,
  jwtRandomness: null,
});

export const createInitialNetworkData = (): Partial<
  Record<SuiChain, NetworkDataEntry>
> => ({
  [SUI_DEVNET_CHAIN]: createEmptyNetworkDataEntry(),
  [SUI_TESTNET_CHAIN]: createEmptyNetworkDataEntry(),
  [SUI_LOCALNET_CHAIN]: createEmptyNetworkDataEntry(),
  [SUI_MAINNET_CHAIN]: createEmptyNetworkDataEntry(),
});
