export const NETWORKS = {
  devnet: {
    fullnodeUrl: "https://fullnode.devnet.sui.io",
    faucetUrl: "https://faucet.devnet.sui.io/gas",
  },
  testnet: {
    fullnodeUrl: "https://fullnode.testnet.sui.io",
    faucetUrl: "https://faucet.testnet.sui.io/gas",
  },
  mainnet: {
    fullnodeUrl: "https://fullnode.mainnet.sui.io",
    faucetUrl: null,
  },
} as const;
