import { useWalletSigningContext } from "@/wallet/hooks/useWalletSigningContext";

/**
 * Returns true when the wallet has an identity ready to sign transactions.
 *
 * - zkLogin networks: requires an unlocked vault AND a valid user session
 * - localnet: the Ed25519 keypair is the signing mechanism; no vault or JWT needed
 *
 * Callers do not need to know which network is active.
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated, isLocalnet, isWalletUnlocked } =
    useWalletSigningContext();
  return isLocalnet ? isWalletUnlocked : isAuthenticated && isWalletUnlocked;
}
