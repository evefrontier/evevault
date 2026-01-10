import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import type { JwtResponse } from "../types/authTypes";

// TODO: This will change to use a Quasar Go API vend endpoint
// In order to exposing the API key to the extension

export const vendJwt = async (
  token: JwtResponse["id_token"],
  deviceParams: {
    nonce: string;
    jwtRandomness: string;
    maxEpoch: string;
  },
): Promise<JwtResponse["id_token"]> => {
  const apiKey = import.meta.env.VITE_FUSIONAUTH_API_KEY;
  const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
  const vendUrl = `${fusionAuthUrl}/api/jwt/vend`;

  if (!apiKey) {
    throw new Error(
      "FusionAuth API key is required. Set VITE_FUSIONAUTH_API_KEY environment variable.",
    );
  }

  const existingClaims = decodeJwt<IdTokenClaims>(token);

  const requestBody: Record<string, unknown> = {
    claims: {
      ...existingClaims,
      nonce: deviceParams.nonce,
    },
  };

  const response = await fetch(vendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JWT vend failed: ${errorText}`);
  }

  const result = await response.json();

  return result.token;
};
