import { useEffect, useState } from "react";
import { localnetKeyService } from "../../services/vaultService";
import { useNetworkStore } from "../../stores/networkStore";
import { isLocalnetChain } from "../../types/networks";
import { isExtension } from "../../utils/environment";

export function useLocalnetAddress(): string | null {
  const { chain } = useNetworkStore();
  const [localnetAddress, setLocalnetAddress] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (isLocalnetChain(chain) && isExtension()) {
      localnetKeyService
        .getAddress()
        .then((addr) => {
          if (!isCancelled) setLocalnetAddress(addr);
        })
        .catch(() => {
          if (!isCancelled) setLocalnetAddress(null);
        });
      return () => {
        isCancelled = true;
      };
    }

    setLocalnetAddress(null);
    return () => {
      isCancelled = true;
    };
  }, [chain]);

  return localnetAddress;
}
