import { useEffect, useState } from "react";
import { localnetKeyService } from "#/services/vaultService";
import { useDeviceStore } from "#/stores/deviceStore";
import { useNetworkStore } from "#/stores/networkStore";
import { isLocalnetChain } from "#/types/networks";
import { isExtension } from "#/utils/environment";

export function useLocalnetAddress(): string | null {
  const { chain } = useNetworkStore();
  const isLocked = useDeviceStore((s) => s.isLocked);
  const [localnetAddress, setLocalnetAddress] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchLocalnetAddress = async () => {
      if (!isLocalnetChain(chain) || !isExtension() || isLocked) {
        setLocalnetAddress(null);
        return;
      }
      try {
        const address = await localnetKeyService.getAddress();
        if (!isCancelled) setLocalnetAddress(address);
      } catch {
        if (!isCancelled) setLocalnetAddress(null);
      }
    };

    fetchLocalnetAddress();

    return () => {
      isCancelled = true;
    };
  }, [chain, isLocked]);

  return localnetAddress;
}
