import type { TokenResponse } from "@evevault/shared/types";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNetworkStore } from "../stores/networkStore";

export async function storeToken(token: TokenResponse, chain?: SuiChain) {
  const network = chain || useNetworkStore.getState().chain;

  const { "evevault:jwt": existingTokens } = await new Promise<{
    "evevault:jwt"?: Record<SuiChain, TokenResponse>;
  }>((resolve) => {
    chrome.storage.local.get("evevault:jwt", (items) => resolve(items));
  });

  // Merge new token with existing tokens
  const updatedTokens = {
    ...(existingTokens || {}),
    [network]: token,
  };

  await chrome.storage.local.set({ "evevault:jwt": updatedTokens });
}

export async function getToken() {
  const result = await chrome.storage.local.get(["evevault:jwt"]);
  return result["evevault:jwt"];
}

export async function clearToken() {
  await chrome.storage.local.remove(["evevault:jwt"]);
}
