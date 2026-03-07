export const FULLNODE_URL = "https://fullnode.devnet.sui.io";

export const SUI_DEVNET_FAUCET = "https://faucet.devnet.sui.io/gas";

/** Sui testnet faucet – open in iframe or new tab to get test SUI for gas. */
export const SUI_FAUCET_TESTNET_URL = "https://faucet.sui.io/?network=testnet";

export const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";

export const SUI_COIN_TYPE = "0x2::sui::SUI";

/** EVE token coin type on testnet – the raw Move type used by Sui RPC and GraphQL APIs. */
export const EVE_TESTNET_COIN_TYPE =
  "0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE";

/** Default epoch duration (24h in ms) when endTimestamp is not yet set for current epoch */
export const DEFAULT_EPOCH_DURATION_MS = 86_400_000;
