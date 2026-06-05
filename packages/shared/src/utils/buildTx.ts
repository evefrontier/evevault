import { buildTransactionBytes } from '@evefrontier/wallet-core/utils'

// Sets the sender of the tx using useWalletSigningContext
// Then builds the transaction bytes
export const buildTx = buildTransactionBytes
