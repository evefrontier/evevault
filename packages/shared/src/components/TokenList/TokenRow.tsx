import { isEveCoinType } from '@evefrontier/wallet-core/eve-token'
import type { SuiChain } from '@mysten/wallet-standard'
import type React from 'react'
import { type KeyboardEvent, useMemo } from 'react'
import Button from '#/components/Button'
import Icon from '#/components/Icon'
import { getMvrTypeName } from '#/sui/mvr'
import type { ExtendedTokenRowProps } from '#/types'
import { SUI_COIN_TYPE } from '#/utils/constants'
import { useBalance } from '#/wallet'
import { getKnownTokenDisplay } from '#/wallet/utils/balanceMetadata'
import {
  LoadingDots,
  scrambleBalanceWithFixedFirst,
  scrambleLetters,
} from './refreshScramble'

/**
 * Shows the MVR package name for cached types (e.g. `@evefrontier/currency`),
 * otherwise a truncated coin type.
 */
function getShortAddress(coinType: string, chain: SuiChain | null) {
  const mvrName = getMvrTypeName(coinType, chain)
  if (mvrName) return mvrName.slice(0, mvrName.indexOf('::'))
  return `${coinType.slice(0, 6)}•••${coinType.slice(-4)}`
}

type TokenRowDisplay = {
  balance: string
  detail: string
  displayBalance: string
  displaySymbol: string
  shortAddress: string
  symbol: string
  tokenName: string
}

/**
 * Prefers live metadata but falls back to known token config because some RPCs
 * omit names for locally configured coin types.
 */
function getTokenName(
  coinType: string,
  metadata?: { name?: string | null; symbol?: string | null } | null,
) {
  const knownDisplay = getKnownTokenDisplay(coinType)
  return metadata?.name || metadata?.symbol || knownDisplay?.name || 'Token'
}

/**
 * Keeps an empty symbol possible so unknown token balances do not display a
 * misleading placeholder ticker.
 */
function getTokenSymbol(
  coinType: string,
  metadata?: { symbol?: string | null } | null,
) {
  return metadata?.symbol || getKnownTokenDisplay(coinType)?.symbol || ''
}

/** Line under the balance: "gas" for SUI, else the token's decimals. */
function getBalanceDetail(
  coinType: string,
  metadata?: { decimals?: number | null } | null,
) {
  if (coinType === SUI_COIN_TYPE) return 'gas'
  return metadata?.decimals != null ? `${metadata.decimals} decimals` : ''
}

/**
 * Recomputes scrambled text on refresh ticks while keeping the real balance
 * stable between animation frames.
 */
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

/**
 * Derives all display strings in one hook so the row JSX only handles layout
 * and interaction state.
 */
function useTokenRowDisplay({
  coinType,
  chain,
  data,
  isLoading,
  isRefreshing,
  refreshTick,
}: {
  coinType: string
  chain: SuiChain | null
  data: ReturnType<typeof useBalance>['data']
  isLoading: boolean
  isRefreshing: boolean
  refreshTick: number
}): TokenRowDisplay {
  const balance = isLoading ? '...' : (data?.formattedBalance ?? '0')
  const symbol = getTokenSymbol(coinType, data?.metadata)
  const displayBalance = useRefreshText(
    balance,
    isRefreshing,
    refreshTick,
    scrambleBalanceWithFixedFirst,
  )
  const displaySymbol = useRefreshText(
    symbol,
    isRefreshing,
    refreshTick,
    scrambleLetters,
  )

  return {
    balance,
    detail: getBalanceDetail(coinType, data?.metadata),
    displayBalance,
    displaySymbol,
    shortAddress: getShortAddress(coinType, chain),
    symbol,
    tokenName: getTokenName(coinType, data?.metadata),
  }
}

/** Diamond icon with the token's first letter; brand-filled for EVE. */
function TokenIcon({ coinType, name }: { coinType: string; name: string }) {
  const brand = isEveCoinType(coinType)
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      className={`token-row__icon${brand ? ' token-row__icon--brand' : ''}`}
    >
      <path className="token-row__icon-frame" d="M14 1 27 14 14 27 1 14Z" />
      <text x="14" y="17.5" textAnchor="middle">
        {name.charAt(0).toUpperCase()}
      </text>
    </svg>
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
    chain,
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
    // biome-ignore lint/a11y/useSemanticElements: This needs to nest other buttons
    <div
      role="button"
      tabIndex={0}
      className={`token-row${isSelected ? ' token-row--selected' : ''}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
    >
      <TokenIcon
        coinType={coinType}
        name={display.symbol || display.tokenName}
      />
      <span className="token-row__name">
        <b>{display.displaySymbol || display.tokenName}</b>
        <span title={coinType}>{display.shortAddress}</span>
      </span>
      <span className="token-row__value">
        <b>
          {display.displayBalance}
          {isRefreshing ? <LoadingDots /> : null}
        </b>
        <span>{display.detail}</span>
      </span>
      <span className="token-row__actions">
        <button
          type="button"
          title={`Copy ${coinType}`}
          aria-label="Copy coin type"
          className="c-icon-btn"
          onClick={(event) => {
            event.stopPropagation()
            onCopyAddress(coinType)
          }}
        >
          <Icon name="Copy" width={14} height={14} color="currentColor" />
        </button>
        {onTransfer && (
          <Button
            variant={isSelected ? 'primary' : 'secondary'}
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onTransfer()
            }}
          >
            Send
          </Button>
        )}
      </span>
    </div>
  )
}
