import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { User } from "oidc-client-ts";

// Sets the sender of the tx and builds the transaction bytes
// If is localnet, sender should be set to the localnet address
// Otherwise, use the user's sui address
export const buildTx = async (
  tx: Transaction,
  sender: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> => {
  tx.setSender(sender);
  const txb = await tx.build({ client: suiClient });
  return txb;
};
