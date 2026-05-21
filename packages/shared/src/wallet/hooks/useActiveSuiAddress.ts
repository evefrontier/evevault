import { useWalletSigningContext } from './useWalletSigningContext';

/**
 * Returns the effective Sui address for the current network:
 * - Localnet (extension only): address of the loaded Ed25519 localnet keypair
 * - All other chains: zkLogin address from the authenticated user's profile
 */
export function useActiveSuiAddress(): string | null {
  return useWalletSigningContext().senderAddress;
}
