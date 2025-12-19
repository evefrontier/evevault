import type { JwtResponse } from "@evevault/shared/types";

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<JwtResponse> {
  const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_FUSION_CLIENT_SECRET;
  const tokenUrl = `${import.meta.env.VITE_FUSION_SERVER_URL}/oauth2/token`;

  const requestBody = {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const data: JwtResponse = await response.json();

  return data;
}
