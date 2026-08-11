import type { SuiChain } from '@mysten/wallet-standard'
import type { Browser } from 'wxt/browser'
import {
  type DappPermissionResult,
  requireDappPermission,
} from '@/lib/background/services/dappPermissions'

export function requireSigningPermission(
  sender: Browser.runtime.MessageSender,
  chain?: SuiChain,
): Promise<DappPermissionResult> {
  return requireDappPermission(sender, chain)
}
