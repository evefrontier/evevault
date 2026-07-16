import { createFileRoute } from '@tanstack/react-router'
import { WalletScreen } from '@/features/wallet/components/WalletScreen'

export const Route = createFileRoute('/wallet/')({
  beforeLoad: () => {
    document.title = 'EVE Vault - Wallet'
  },
  component: WalletScreen,
})
