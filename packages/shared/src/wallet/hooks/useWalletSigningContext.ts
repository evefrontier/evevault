import type { IntentScope } from "@mysten/sui/cryptography";
import type { User } from "oidc-client-ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUserForNetwork } from "#/auth";
import { useDevice } from "#/hooks/useDevice";
import { useNetworkStore } from "#/stores/networkStore";
import { createSuiClient } from "#/sui";
import { isLocalnetChain } from "#/types/networks";
import type { ZkSignAnyParams } from "#/types/wallet";
import { signForChain } from "#/wallet/signForChain";
import { useLocalnetAddress } from "./useLocalnetAddress";

export type WalletSigningMode = "localnet" | "zklogin";

export function useWalletSigningContext() {
  const [networkUser, setNetworkUser] = useState<User | null>(null);

  const { ephemeralPublicKey, getZkProof, maxEpoch, isLocked } = useDevice();
  const { chain, localnetUrl } = useNetworkStore();
  const localnetAddress = useLocalnetAddress();
  const isLocalnet = isLocalnetChain(chain);

  useEffect(() => {
    const fetchNetworkUser = async () => {
      const user = await getUserForNetwork(chain);
      setNetworkUser(user);
    };
    fetchNetworkUser();
  }, [chain]);

  const suiClient = useMemo(
    () => createSuiClient(chain, isLocalnet ? localnetUrl : undefined),
    [chain, isLocalnet, localnetUrl],
  );

  const senderAddress = isLocalnet
    ? localnetAddress
    : ((networkUser?.profile?.sui_address as string | undefined) ?? null);

  const getSenderAddress = useCallback(async () => {
    if (isLocalnet) return localnetAddress;
    const user = await getUserForNetwork(chain);
    return (user?.profile?.sui_address as string | undefined) ?? null;
  }, [isLocalnet, localnetAddress, chain]);

  const getZkLoginUser = useCallback(async () => {
    if (isLocalnet) return null;
    return getUserForNetwork(chain);
  }, [chain, isLocalnet]);

  const sign = useCallback(
    async (scope: IntentScope, msgBytes: Uint8Array) => {
      const user = await getZkLoginUser();
      return signForChain(scope, msgBytes, {
        chain,
        user,
        getZkProof: isLocalnet
          ? null
          : (getZkProof as ZkSignAnyParams["getZkProof"]),
        localnetAddress,
      });
    },
    [chain, isLocalnet, getZkProof, localnetAddress, getZkLoginUser],
  );

  const isWalletUnlocked = isLocalnet
    ? !!localnetAddress
    : !isLocked && !!ephemeralPublicKey && !!maxEpoch;
  // isAuthenticated and senderAddress derive from networkUser (React state) which
  // may lag by one render after a network switch. getSenderAddress() always
  // queries the network-scoped user from storage and is safe for actual signing.
  const isAuthenticated = isLocalnet ? true : !!networkUser;

  return {
    chain,
    localnetUrl,
    mode: (isLocalnet ? "localnet" : "zklogin") as WalletSigningMode,
    isLocalnet,
    isAuthenticated,
    isWalletUnlocked,
    senderAddress,
    localnetAddress,
    networkUser,
    suiClient,
    getSenderAddress,
    sign,
  };
}
