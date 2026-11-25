import { useQueryClient } from '@tanstack/react-query'
import type React from 'react'
import { useState } from 'react'
import { useToast } from '#/components/Toast'
import { useTokenListStore } from '#/stores'
import type { TokenListProps } from '#/types'
import { isPinnedToken } from '#/types/networks'
import { isExtension } from '#/utils/environment'
import {
  removeSelectedToken,
  useCopyAddress,
  useRefreshBalances,
  useTokensForChain,
} from './TokenSection.helpers'
import { AssetsHeader, BalanceReadout, TokenRows } from './TokenSection.parts'
import './TokenSection.css'

export const TokenSection: React.FC<TokenListProps> = ({
  user,
  chain,
  onAddToken,
  onSendToken,
  balanceAddress,
  localnetUrl,
}) => {
  const queryClient = useQueryClient()
  const { tokens, removeToken } = useTokenListStore()
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const { showToast } = useToast()
  const { isRefreshing, refreshBalances, refreshTick } = useRefreshBalances(
    queryClient,
    showToast,
  )
  const tokensForChain = useTokensForChain(chain, tokens)
  const handleCopyAddress = useCopyAddress(showToast)
  // Popup: eyebrow header; web: framed panel with the token count in the readout
  const inPopup = isExtension()
  const handleRemoveToken = () =>
    removeSelectedToken({
      chain,
      removeToken,
      selectedToken,
      setSelectedToken,
    })

  return (
    <div className="assets">
      <BalanceReadout
        tokensForChain={tokensForChain}
        showCount={!inPopup}
        user={user}
        chain={chain}
        balanceAddress={balanceAddress}
        localnetUrl={localnetUrl}
      />

      <div
        className={`assets__list${inPopup ? '' : ' assets__list--panel c-panel'}`}
      >
        <AssetsHeader
          count={tokensForChain.length}
          inPopup={inPopup}
          isRefreshing={isRefreshing}
          onRefreshBalances={refreshBalances}
          onAddToken={onAddToken}
          canRemove={Boolean(
            selectedToken && chain && !isPinnedToken(chain, selectedToken),
          )}
          onRemoveToken={handleRemoveToken}
        />

        <div className="assets__rows">
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
    </div>
  )
}

export const TokenListSection = TokenSection

export default TokenSection
