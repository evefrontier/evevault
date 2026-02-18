import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { User } from "oidc-client-ts";

export const buildTx = async (
  tx: Transaction,
  user: User,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> => {
  tx.setSender(user.profile?.sui_address as string);
  const txb = await tx.build({ client: suiClient });
  return txb;
};
