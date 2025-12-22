import type { ZkLoginAddressResponse } from "../types/enoki";
import type { GetZkLoginAddressParams } from "./types";

export async function getZkLoginAddress(
  params: GetZkLoginAddressParams,
): Promise<ZkLoginAddressResponse> {
  const { jwt, enokiApiKey } = params;

  const response = await fetch("https://api.enoki.mystenlabs.com/v1/zklogin", {
    method: "GET",
    headers: {
      Authorization: enokiApiKey,
      "zklogin-jwt": jwt,
    },
  });

  const responseJson = await response.json();
  return responseJson as unknown as ZkLoginAddressResponse;
}
