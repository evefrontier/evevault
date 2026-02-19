import type { ZkLoginAddressResponse } from "../types/enoki";
import type { GetZkLoginAddressParams } from "./types";

const cache = new Map<string, ZkLoginAddressResponse>();

function cacheKey(params: GetZkLoginAddressParams): string {
  return `${params.enokiApiKey}:${params.jwt}`;
}

/**
 * Clear the in-memory cache of zkLogin address lookups.
 * Call on logout so a new login gets a fresh API call.
 */
export function clearZkLoginAddressCache(): void {
  cache.clear();
}

export async function getZkLoginAddress(
  params: GetZkLoginAddressParams,
): Promise<ZkLoginAddressResponse> {
  const key = cacheKey(params);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const { jwt, enokiApiKey } = params;

  const response = await fetch("https://api.enoki.mystenlabs.com/v1/zklogin", {
    method: "GET",
    headers: {
      Authorization: enokiApiKey,
      "zklogin-jwt": jwt,
    },
  });

  const responseJson =
    (await response.json()) as unknown as ZkLoginAddressResponse;

  if (responseJson.data !== undefined) {
    cache.set(key, responseJson);
  }

  return responseJson;
}
