import type React from 'react'
import Button from '#/components/Button'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import type { ExtendedTokenRowProps } from '#/types'
import { formatAddress } from '#/utils'
import { TokenRow } from './TokenRow'

type TokenRowsProps = Pick<
  ExtendedTokenRowProps,
  | 'balanceAddress'
  | 'chain'
  | 'isRefreshing'
  | 'localnetUrl'
  | 'onCopyAddress'
  | 'refreshTick'
  | 'user'
> & {
  onSendToken?: (coinType: string) => void
  selectedToken: string | null
  setSelectedToken: (coinType: string | null) => void
  tokensForChain: string[]
}

/**
 * Reserves the same vertical space when no wallet address is available so the
 * token list header does not jump between auth and loading states.
 */
export function WalletAddressRow({
  walletAddress,
  onCopyAddress,
}: {
  walletAddress?: string
  onCopyAddress: (address: string) => void
}) {
  if (!walletAddress) return <div className="h-6 flex-shrink-0" />

  return (
    <div className="flex justify-end items-center gap-2 w-full flex-shrink-0">
      <div className="flex items-center gap-1">
        <Text variant="regular" size="small" color="neutral-80">
          Wallet address:
        </Text>
        <button
          type="button"
          className="flex items-center gap-1 px-1 py-0.5 bg-transparent border-none cursor-pointer hover:opacity-80"
          onClick={() => onCopyAddress(walletAddress)}
        >
          <Text variant="light" size="small" color="grey-neutral">
            {formatAddress(walletAddress)}
          </Text>
          <Icon name="Copy" size="small" color="grey-neutral" />
        </button>
      </div>
    </div>
  )
}

/**
 * Keeps the refresh button in the balance column because refreshing affects
 * amounts, not token metadata or addresses.
 */
export function TokenListHeader({
  isRefreshing,
  onRefreshBalances,
}: {
  isRefreshing: boolean
  onRefreshBalances: () => void
}) {
  return (
    <div className="flex justify-between items-start gap-2 w-full flex-shrink-0">
      <div className="flex items-center gap-[60px]">
        <Text
          variant="label-semi"
          size="small"
          color="neutral-50"
          className="w-[140px]"
        >
          TOKEN
        </Text>
        <Text
          variant="label-semi"
          size="small"
          color="neutral-50"
          className="w-[60px]"
        >
          ADDRESS
        </Text>
      </div>
      <button
        type="button"
        className="flex items-center justify-end gap-1 bg-transparent border-none cursor-pointer rounded opacity-90 hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-left min-w-0"
        onClick={onRefreshBalances}
        disabled={isRefreshing}
        title="Refresh balances"
        aria-label="Refresh balances"
      >
        <Text
          variant="label-semi"
          size="small"
          color="neutral-50"
          className="text-right"
        >
          BALANCE
        </Text>
        <Icon
          name="Refresh"
          width={12}
          height={12}
          color="grey-neutral"
          className={`flex-shrink-0 -mt-1 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  )
}

/**
 * Renders an empty state inside the list area so the action row can stay fixed
 * below it.
 */
function EmptyTokenList() {
  return (
    <div className="flex justify-center items-center py-6 w-full">
      <Text size="large" color="grey-neutral">
        No tokens added yet
      </Text>
    </div>
  )
}

/**
 * Toggles row selection because transfer/remove actions apply to one selected
 * token at a time.
 */
function getNextSelectedToken(selectedToken: string | null, coinType: string) {
  return selectedToken === coinType ? null : coinType
}

/**
 * Owns token row rendering so selection, copy, transfer, and refresh props stay
 * wired consistently for every coin type.
 */
export function TokenRows({
  balanceAddress,
  chain,
  isRefreshing = false,
  localnetUrl,
  onCopyAddress,
  onSendToken,
  refreshTick = 0,
  selectedToken,
  setSelectedToken,
  tokensForChain,
  user,
}: TokenRowsProps) {
  if (tokensForChain.length === 0) return <EmptyTokenList />

  return tokensForChain.map((coinType) => (
    <TokenRow
      key={coinType}
      coinType={coinType}
      user={user}
      chain={chain}
      balanceAddress={balanceAddress}
      localnetUrl={localnetUrl}
      isSelected={selectedToken === coinType}
      onSelect={() =>
        setSelectedToken(getNextSelectedToken(selectedToken, coinType))
      }
      onCopyAddress={onCopyAddress}
      onTransfer={onSendToken ? () => onSendToken(coinType) : undefined}
      isRefreshing={isRefreshing}
      refreshTick={refreshTick}
    />
  ))
}

/**
 * Keeps add/remove controls outside the scrolling token rows so destructive
 * actions do not move as the list length changes.
 */
export function TokenActions({
  canRemove,
  onAddToken,
  onRemoveToken,
}: {
  canRemove: boolean
  onAddToken?: () => void
  onRemoveToken: () => void
}) {
  return (
    <div className="flex justify-center items-center gap-1 w-full flex-shrink-0">
      {onAddToken ? (
        <Button variant="primary" size="small" onClick={onAddToken}>
          Add token
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="small"
        onClick={onRemoveToken}
        disabled={!canRemove}
      >
        Remove token
      </Button>
    </div>
  )
}

/**
 * Uses a fixed extension height but flexible web height to preserve the popup
 * layout while still letting web pages fill the available space.
 */
export function getTokenListContainerProps(isMobile: boolean) {
  return {
    className: `flex flex-col items-start p-4 px-2 gap-3 w-full bg-crude-dark border border-quantum-60 overflow-hidden ${isMobile ? '' : 'flex-1 min-h-[300px]'}`,
    style: isMobile
      ? ({ height: '207px', flexShrink: 0 } as React.CSSProperties)
      : undefined,
  }
}
