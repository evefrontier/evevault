import { isEveCoinType } from '@evefrontier/wallet-core/eve-token'
import Button from '#/components/Button'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import type { ExtendedTokenRowProps } from '#/types'
import { SUI_COIN_TYPE } from '#/utils/constants'
import { useBalance } from '#/wallet'
import { getKnownTokenDisplay } from '#/wallet/utils/balanceMetadata'
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

/** One readout cell: label over a large balance. */
function ReadoutCell({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="assets__readout-cell">
      <span className="c-label">{label}</span>
      <b className="assets__readout-value" title={value}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
    </div>
  )
}

/** Balance cell for one coin type, labelled "Balance" or "Gas". */
function BalanceCell({
  coinType,
  label,
  user,
  chain,
  balanceAddress,
  localnetUrl,
}: Pick<
  ExtendedTokenRowProps,
  'coinType' | 'user' | 'chain' | 'balanceAddress' | 'localnetUrl'
> & { label: string }) {
  const { data, isLoading } = useBalance({
    user,
    chain,
    coinType,
    address: balanceAddress,
    localnetUrl,
  })
  const symbol =
    data?.metadata?.symbol || getKnownTokenDisplay(coinType)?.symbol || ''
  return (
    <ReadoutCell
      label={symbol ? `${label} · ${symbol}` : label}
      value={isLoading ? '…' : (data?.formattedBalance ?? '0')}
      unit={symbol}
    />
  )
}

/** Headline balances: EVE when tracked, SUI for gas, and the token count on web. */
export function BalanceReadout({
  tokensForChain,
  showCount,
  user,
  chain,
  balanceAddress,
  localnetUrl,
}: Pick<
  ExtendedTokenRowProps,
  'user' | 'chain' | 'balanceAddress' | 'localnetUrl'
> & { tokensForChain: string[]; showCount: boolean }) {
  const eveCoinType = tokensForChain.find(isEveCoinType)
  const balanceProps = { user, chain, balanceAddress, localnetUrl }
  return (
    <div className="assets__readout">
      {eveCoinType && (
        <BalanceCell coinType={eveCoinType} label="Balance" {...balanceProps} />
      )}
      <BalanceCell coinType={SUI_COIN_TYPE} label="Gas" {...balanceProps} />
      {showCount && (
        <ReadoutCell
          label="Tokens tracked"
          value={String(tokensForChain.length)}
        />
      )}
    </div>
  )
}

/** List header: eyebrow with the count in the popup, panel header bar on web. */
export function AssetsHeader({
  count,
  inPopup,
  isRefreshing,
  onRefreshBalances,
  onAddToken,
  canRemove,
  onRemoveToken,
}: {
  count: number
  inPopup: boolean
  isRefreshing: boolean
  onRefreshBalances: () => void
  onAddToken?: () => void
  canRemove: boolean
  onRemoveToken: () => void
}) {
  return (
    <div className={inPopup ? 'assets__head' : 'c-panel__head'}>
      {inPopup ? <span className="c-eyebrow">Assets · {count}</span> : 'Assets'}
      <div className="assets__tools">
        <button
          type="button"
          className="c-icon-btn"
          onClick={onRefreshBalances}
          disabled={isRefreshing}
          title="Refresh balances"
          aria-label="Refresh balances"
        >
          <Icon
            name="Refresh"
            width={14}
            height={14}
            color="currentColor"
            className={isRefreshing ? 'animate-spin' : undefined}
          />
        </button>
        {canRemove && (
          <Button variant="secondary" size="small" onClick={onRemoveToken}>
            Remove
          </Button>
        )}
        {onAddToken && (
          <Button variant="secondary" size="small" onClick={onAddToken}>
            + Add token
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Renders an empty state inside the list area so the action row can stay fixed
 * below it.
 */
function EmptyTokenList() {
  return (
    <div className="assets__empty">
      <Text color="grey-neutral">No tokens added yet</Text>
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
