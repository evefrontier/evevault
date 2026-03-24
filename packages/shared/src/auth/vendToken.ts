import type { JwtResponse } from "../types/authTypes";
import { getApiContext } from "./getApiContext";

export const vendJwt = async (
  token: JwtResponse["id_token"],
  deviceParams: {
    nonce: string;
  },
): Promise<JwtResponse["id_token"]> => {
  const { apiBaseUrl, tenant } = getApiContext(token);
  const vendUrl = `${apiBaseUrl}/auth/zklogin/vend-jwt`;

  const requestBody: Record<string, unknown> = {
    nonce: deviceParams.nonce,
  };

  const response = await fetch(vendUrl, {
    method: "POST",
    headers: {
      "X-Tenant": tenant,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JWT vend failed: ${errorText}`);
  }

  const result = await response.json();

  return result.token as JwtResponse["id_token"];
};
