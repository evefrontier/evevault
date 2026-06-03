import type React from 'react'
import { type KeyboardEvent, useMemo } from 'react'
import Button from '#/components/Button'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import type { ExtendedTokenRowProps } from '#/types'
import { useBalance } from '#/wallet'
import { getKnownTokenDisplay } from '#/wallet/utils/balanceMetadata'
import {
  LoadingDots,
  scrambleBalanceWithFixedFirst,
  scrambleLetters,
} from './refreshScramble'

type TokenRowDisplay = {
  balance: string
  displayBalance: string
  displaySymbol: string
  shortAddress: string
  symbol: string
  tokenName: string
}

function getTokenName(
  coinType: string,
  metadata?: { name?: string | null; symbol?: string | null } | null,
) {
  const knownDisplay = getKnownTokenDisplay(coinType)
  return metadata?.name || metadata?.symbol || knownDisplay?.name || 'Token'
}

function getTokenSymbol(
  coinType: string,
  metadata?: { symbol?: string | null } | null,
) {
  return metadata?.symbol || getKnownTokenDisplay(coinType)?.symbol || ''
}

function useRefreshText(
  value: string,
  isRefreshing: boolean,
  refreshTick: number,
  scramble: (value: string) => string,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick prop drives re-scramble each 200ms
  return useMemo(
    () => (isRefreshing ? scramble(value) : value),
    [isRefreshing, value, refreshTick, scramble],
  )
}

function useTokenRowDisplay({
  coinType,
  data,
  isLoading,
  isRefreshing,
  refreshTick,
}: {
  coinType: string
  data: ReturnType<typeof useBalance>['data']
  isLoading: boolean
  isRefreshing: boolean
  refreshTick: number
}): TokenRowDisplay {
  const balance = isLoading ? '...' : (data?.formattedBalance ?? '0')
  const symbol = getTokenSymbol(coinType, data?.metadata)

  return {
    balance,
    displayBalance: useRefreshText(
      balance,
      isRefreshing,
      refreshTick,
      scrambleBalanceWithFixedFirst,
    ),
    displaySymbol: useRefreshText(
      symbol,
      isRefreshing,
      refreshTick,
      scrambleLetters,
    ),
    shortAddress: `${coinType.slice(0, 6)}•••${coinType.slice(-4)}`,
    symbol,
    tokenName: getTokenName(coinType, data?.metadata),
  }
}

function getContainerClasses(isSelected: boolean) {
  return [
    'flex flex-col w-full p-2 gap-4',
    'border-none cursor-pointer text-left transition-colors',
    isSelected
      ? 'bg-quantum-40 hover:bg-quantum-40'
      : 'bg-transparent hover:bg-quantum-10',
  ].join(' ')
}

function TokenAddress({
  coinType,
  shortAddress,
  onCopyAddress,
}: {
  coinType: string
  shortAddress: string
  onCopyAddress: (address: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Text variant="light" size="small" color="grey-neutral">
        {shortAddress}
      </Text>
      <button
        type="button"
        className="flex items-center justify-center w-4 h-4 p-0 bg-transparent border-none cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
        onClick={(event) => {
          event.stopPropagation()
          onCopyAddress(coinType)
        }}
      >
        <Icon name="Copy" size="small" color="grey-neutral" />
      </button>
    </div>
  )
}

function TokenBalance({
  displayBalance,
  displaySymbol,
  isRefreshing,
}: {
  displayBalance: string
  displaySymbol: string
  isRefreshing: boolean
}) {
  return (
    <div className="flex items-center gap-6 text-right">
      <Text variant="regular" size="medium">
        {displayBalance}
        {isRefreshing ? <LoadingDots /> : null} {displaySymbol}
      </Text>
    </div>
  )
}

function TransferAction({ onTransfer }: { onTransfer?: () => void }) {
  if (!onTransfer) return null

  return (
    <div className="flex justify-end w-full">
      <Button
        variant="secondary"
        size="small"
        onClick={(event) => {
          event.stopPropagation()
          onTransfer()
        }}
      >
        Transfer
      </Button>
    </div>
  )
}

export const TokenRow: React.FC<ExtendedTokenRowProps> = ({
  coinType,
  user,
  chain,
  balanceAddress,
  localnetUrl,
  isSelected,
  onSelect,
  onCopyAddress,
  onTransfer,
  isRefreshing = false,
  refreshTick = 0,
}) => {
  const { data, isLoading } = useBalance({
    user,
    chain,
    coinType,
    address: balanceAddress,
    localnetUrl,
  })
  const display = useTokenRowDisplay({
    coinType,
    data,
    isLoading,
    isRefreshing,
    refreshTick,
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: This needs to nest another button
    <div
      role="button"
      tabIndex={0}
      className={getContainerClasses(isSelected)}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 w-[140px]">
            <Text variant="bold" size="medium">
              {display.tokenName}
            </Text>
          </div>
          <TokenAddress
            coinType={coinType}
            shortAddress={display.shortAddress}
            onCopyAddress={onCopyAddress}
          />
        </div>
        <TokenBalance
          displayBalance={display.displayBalance}
          displaySymbol={display.displaySymbol}
          isRefreshing={isRefreshing}
        />
      </div>
      {isSelected ? <TransferAction onTransfer={onTransfer} /> : null}
    </div>
  )
}
