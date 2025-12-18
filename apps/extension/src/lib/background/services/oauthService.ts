function getAuthUrl(params: {
  nonce: string;
  jwtRandomness: string;
  maxEpoch: string;
}) {
  const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
  const redirectUri = chrome.identity.getRedirectURL();

  const url = new URL(
    import.meta.env.VITE_FUSION_SERVER_URL.replace(/\/$/, "") +
      "/oauth2/authorize",
  );

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("nonce", params.nonce);

  return url;
}

export { getAuthUrl };
