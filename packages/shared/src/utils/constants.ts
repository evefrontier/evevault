export const FULLNODE_URL =
  "https://fullnode.devnet.sui.io"; /** Faucet URLs are per-network; use getFaucetUrlForChain(chain) from @evevault/shared/sui. */

export const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";

export const SUI_COIN_TYPE = "0x2::sui::SUI";

/** EVE token coin type on testnet – the raw Move type used by Sui RPC and GraphQL APIs. */
export const EVE_TESTNET_COIN_TYPE =
  "0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE";

/** Default epoch duration (24h in ms) when endTimestamp is not yet set for current epoch */
export const DEFAULT_EPOCH_DURATION_MS = 86_400_000;

/** Message shown on every transfer screen: network fee is paid in SUI. */
export const GAS_FEE_WARNING_MESSAGE =
  "This transfer will incur a network fee (gas) paid in SUI.";
