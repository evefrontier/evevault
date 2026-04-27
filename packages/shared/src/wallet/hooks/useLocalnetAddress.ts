import { useEffect, useState } from "react";
import { localnetKeyService } from "../../services/vaultService";
import { useNetworkStore } from "../../stores/networkStore";
import { isLocalnetChain } from "../../types/networks";
import { isExtension } from "../../utils/environment";

export function useLocalnetAddress(): string | null {
  const { chain } = useNetworkStore();
  const [localnetAddress, setLocalnetAddress] = useState<string | null>(null);

  useEffect(() => {
    if (isLocalnetChain(chain) && isExtension()) {
      localnetKeyService
        .getAddress()
        .then(setLocalnetAddress)
        .catch(() => setLocalnetAddress(null));
      return;
    }

    setLocalnetAddress(null);
  }, [chain]);

  return localnetAddress;
}
