import { useQueryClient } from '@tanstack/react-query'
import type React from 'react'
import { useState } from 'react'
import { useToast } from '#/components/Toast'
import { useResponsive } from '#/hooks'
import { useTokenListStore } from '#/stores'
import type { TokenListProps } from '#/types'
import {
  removeSelectedToken,
  useCopyAddress,
  useRefreshBalances,
  useTokensForChain,
} from './TokenSection.helpers'
import {
  getTokenListContainerProps,
  TokenActions,
  TokenListHeader,
  TokenRows,
  WalletAddressRow,
} from './TokenSection.parts'

export const TokenSection: React.FC<
  TokenListProps & { walletAddress?: string }
> = ({
  user,
  chain,
  onAddToken,
  onSendToken,
  walletAddress,
  balanceAddress,
  localnetUrl,
}) => {
  const queryClient = useQueryClient()
  const { tokens, removeToken } = useTokenListStore()
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const { showToast } = useToast()
  const { isMobile } = useResponsive()
  const { isRefreshing, refreshBalances, refreshTick } = useRefreshBalances(
    queryClient,
    showToast,
  )
  const tokensForChain = useTokensForChain(chain, tokens)
  const handleCopyAddress = useCopyAddress(showToast)

  const tokenListContainerProps = getTokenListContainerProps(isMobile)
  const handleRemoveToken = () =>
    removeSelectedToken({
      chain,
      removeToken,
      selectedToken,
      setSelectedToken,
    })

  return (
    <div className="flex flex-col items-start gap-2 w-full flex-1 min-h-0">
      <WalletAddressRow
        walletAddress={walletAddress}
        onCopyAddress={handleCopyAddress}
      />

      <div {...tokenListContainerProps}>
        <TokenListHeader
          isRefreshing={isRefreshing}
          onRefreshBalances={refreshBalances}
        />

        <div className="flex flex-col items-start gap-1 w-full flex-1 min-h-0 overflow-y-auto">
          <TokenRows
            balanceAddress={balanceAddress}
            chain={chain}
            isRefreshing={isRefreshing}
            localnetUrl={localnetUrl}
            onCopyAddress={handleCopyAddress}
            onSendToken={onSendToken}
            refreshTick={refreshTick}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            tokensForChain={tokensForChain}
            user={user}
          />
        </div>
      </div>

      <TokenActions
        canRemove={Boolean(selectedToken && chain)}
        onAddToken={onAddToken}
        onRemoveToken={handleRemoveToken}
      />
    </div>
  )
}

export const TokenListSection = TokenSection

export default TokenSection
