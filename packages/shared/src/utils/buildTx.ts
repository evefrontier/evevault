import type { SuiGrpcClient } from '@mysten/sui/grpc';
import type { Transaction } from '@mysten/sui/transactions';

// Sets the sender of the tx using useWalletSigningContext
// Then builds the transaction bytes
export const buildTx = async (
  tx: Transaction,
  sender: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> => {
  tx.setSender(sender);
  const txb = await tx.build({ client: suiClient });
  return txb;
};
