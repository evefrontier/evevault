import type { IntentScope } from "@mysten/sui/cryptography";
import { useCallback, useMemo } from "react";
import { getUserForNetwork } from "#/auth";
import { useAuth } from "#/auth/hooks/useAuth";
import { useDevice } from "#/hooks/useDevice";
import { useNetworkStore } from "#/stores/networkStore";
import { createSuiClient } from "#/sui";
import { isLocalnetChain } from "#/types/networks";
import type { ZkSignAnyParams } from "#/types/wallet";
import { signForChain } from "#/wallet/signForChain";
import { useLocalnetAddress } from "./useLocalnetAddress";

export type WalletSigningMode = "localnet" | "zklogin";

export function useWalletSigningContext() {
  const { user } = useAuth();

  const { ephemeralPublicKey, getZkProof, isLocked } = useDevice();
  const { chain, localnetUrl } = useNetworkStore();
  const localnetAddress = useLocalnetAddress();
  const isLocalnet = isLocalnetChain(chain);

  const suiClient = useMemo(
    () => createSuiClient(chain, isLocalnet ? localnetUrl : undefined),
    [chain, isLocalnet, localnetUrl],
  );

  const senderAddress = isLocalnet
    ? localnetAddress
    : ((user?.profile?.sui_address as string | undefined) ?? null);

  // getSenderAddress and getZkLoginUser read fresh from storage rather than
  // relying on React render state — safe to call just before signing.
  const getSenderAddress = useCallback(async () => {
    if (isLocalnet) return localnetAddress;
    const networkUser = await getUserForNetwork(chain);
    return (networkUser?.profile?.sui_address as string | undefined) ?? null;
  }, [isLocalnet, localnetAddress, chain]);

  const getZkLoginUser = useCallback(async () => {
    if (isLocalnet) return null;
    return getUserForNetwork(chain);
  }, [chain, isLocalnet]);

  const sign = useCallback(
    async (scope: IntentScope, msgBytes: Uint8Array) => {
      const zkLoginUser = await getZkLoginUser();
      return signForChain(scope, msgBytes, {
        chain,
        user: zkLoginUser,
        getZkProof: isLocalnet
          ? null
          : (getZkProof as ZkSignAnyParams["getZkProof"]),
        localnetAddress,
      });
    },
    [chain, isLocalnet, getZkProof, localnetAddress, getZkLoginUser],
  );

  const isWalletUnlocked =
    !isLocked && (isLocalnet ? !!localnetAddress : !!ephemeralPublicKey);

  return {
    chain,
    localnetUrl,
    mode: (isLocalnet ? "localnet" : "zklogin") as WalletSigningMode,
    isLocalnet,
    isAuthenticated: !!user,
    isWalletUnlocked,
    senderAddress,
    localnetAddress,
    user,
    suiClient,
    getSenderAddress,
    sign,
  };
}
