import type { SuiChain } from '@mysten/wallet-standard'
import {
  type DappPermissionResult,
  requireDappPermission,
} from '@/lib/background/services/dappPermissions'

export function requireSigningPermission(
  sender: chrome.runtime.MessageSender,
  chain?: SuiChain,
): Promise<DappPermissionResult> {
  return requireDappPermission(sender, chain)
}
