import type { SuiChain } from "@mysten/wallet-standard";
import { DEFAULT_EPOCH_DURATION_MS } from "../utils/constants";
import { createLogger } from "../utils/logger";
import { createSuiGraphQLClient } from "./graphqlClient";
import { EPOCH_QUERY } from "./queries/epoch";
import type { EpochQueryResponse } from "./types";

const log = createLogger();

/**
 * Fetches current epoch and its end timestamp via Sui GraphQL (non-deprecated).
 * Used for zkLogin device/nonce setup; avoids relying on gRPC on JSON-RPC-only endpoints.
 */
export async function getCurrentEpochFromGraphQL(chain: SuiChain): Promise<{
  numericMaxEpoch: number;
  maxEpochTimestampMs: number;
}> {
  const client = createSuiGraphQLClient(chain);
  const result = await client.query<EpochQueryResponse>({
    query: EPOCH_QUERY,
    variables: {},
  });

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join(", ");
    throw new Error(`GraphQL epoch query failed: ${message}`);
  }

  const epoch = result.data?.epoch;
  if (!epoch) {
    throw new Error("Failed to get epoch data from GraphQL");
  }

  const numericMaxEpoch = Number(epoch.epochId);
  const startMs = epoch.startTimestamp
    ? new Date(epoch.startTimestamp).getTime()
    : 0;
  const endMs = epoch.endTimestamp
    ? new Date(epoch.endTimestamp).getTime()
    : startMs + DEFAULT_EPOCH_DURATION_MS;

  if (!epoch.endTimestamp) {
    log.debug("Epoch endTimestamp missing; using start + 24h fallback", {
      chain,
      epochId: numericMaxEpoch,
    });
  }

  return {
    numericMaxEpoch,
    maxEpochTimestampMs: endMs,
  };
}
