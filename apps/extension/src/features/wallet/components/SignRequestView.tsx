import {
  Button,
  Checkbox,
  ContextChips,
  Heading,
  KvRow,
  Text,
  TopBar,
  TopBarStrip,
} from '@evevault/shared/components'
import { getCurrentTenantId } from '@evevault/shared/stores'
import type { DappRequestContext } from '@evevault/shared/types'
import { formatAddress } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import { type ReactNode, useState } from 'react'
import type { useSignPopupAuth } from '@/features/wallet/hooks'
import { SignPopupAuthGate } from './SignPopupAuthGate'
import './SignRequestView.css'

const DEFAULT_ACKNOWLEDGEMENT_LABEL =
  'I understand the risks and want to approve this request.'

type SignRequestViewProps = {
  auth: ReturnType<typeof useSignPopupAuth>
  title: string
  hasPending: boolean
  loading: boolean
  error: string | null
  loadingMessage: string
  chain?: SuiChain
  dapp?: DappRequestContext
  accountAddress?: string
  requestKind?: string
  /** When true, Approve stays disabled until the user ticks the acknowledgement. */
  requireAcknowledgement?: boolean
  acknowledgementLabel?: string
  /**
   * When set, Approve is disabled, this message renders as a warning banner, and
   * the acknowledgement checkbox is hidden. Reject stays available.
   */
  approveBlockedReason?: string | null
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
  children: ReactNode
}

function formatConnectedAt(connectedAt: number | undefined): string | null {
  if (!connectedAt) return null
  return new Date(connectedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function RequestContextPanel({
  dapp,
  accountAddress,
  requestKind,
}: {
  dapp?: DappRequestContext
  accountAddress?: string
  requestKind?: string
}) {
  const connectedAt = formatConnectedAt(dapp?.connectedAt)
  if (!dapp && !accountAddress && !requestKind) return null

  return (
    <div className="c-card c-card--bright">
      <dl className="c-kv sign-view__context">
        <KvRow label="Site" value={dapp?.origin} title={dapp?.url} />
        <KvRow
          label="Account"
          value={accountAddress && formatAddress(accountAddress, 10, 8)}
          title={accountAddress}
        />
        <KvRow label="Request" value={requestKind} />
        <KvRow label="Connected" value={connectedAt} />
      </dl>
    </div>
  )
}

/** Top bar with the server and network chips, then the approval strip. */
function SignTopBar({ chain }: { chain?: SuiChain }) {
  return (
    <TopBar
      flush
      end={<ContextChips tenantId={getCurrentTenantId()} chain={chain} />}
      strip={
        <TopBarStrip label="Approval" tone="approval">
          A site is asking you to sign
        </TopBarStrip>
      }
    />
  )
}

export function SignRequestView({
  auth,
  title,
  hasPending,
  loading,
  error,
  loadingMessage,
  chain,
  dapp,
  accountAddress,
  requestKind,
  requireAcknowledgement = false,
  acknowledgementLabel = DEFAULT_ACKNOWLEDGEMENT_LABEL,
  approveBlockedReason = null,
  onApprove,
  onReject,
  children,
}: SignRequestViewProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  // Keep Approve disabled until the keeper's lock state is confirmed, so a stale
  // unlocked flag can't let the user fire a sign the keeper will reject.
  const approveDisabled =
    loading ||
    !auth.lockChecked ||
    !!approveBlockedReason ||
    (requireAcknowledgement && !acknowledged)
  return (
    <SignPopupAuthGate
      isLocked={auth.isLocked}
      isPinSet={auth.isPinSet}
      unlock={auth.unlock}
      user={auth.user}
      loading={auth.loading}
      login={auth.login}
      title={title}
      onCancel={onReject}
      cancelDisabled={auth.loading || !hasPending}
    >
      {!hasPending ? (
        <div style={{ padding: '20px' }}>
          <Text>{loadingMessage}</Text>
          {error && <Text color="error">Error: {error}</Text>}
        </div>
      ) : (
        <div className="sign-view">
          <SignTopBar chain={chain} />

          <div className="sign-view__body">
            <div className="sign-view__heading">
              <span className="c-eyebrow">Request</span>
              <Heading level={2}>{title}</Heading>
            </div>

            <RequestContextPanel
              dapp={dapp}
              accountAddress={accountAddress}
              requestKind={requestKind}
            />

            {children}

            {error && <Text color="error">Error: {error}</Text>}

            {approveBlockedReason && (
              <div
                className="c-banner c-banner--red"
                role="alert"
                data-testid="approve-blocked-reason"
              >
                <Text variant="light" size="xsmall">
                  {approveBlockedReason}
                </Text>
              </div>
            )}

            {!approveBlockedReason && requireAcknowledgement && (
              <Checkbox
                name="acknowledge-risk"
                isChecked={acknowledged}
                isDisabled={loading}
                text={acknowledgementLabel}
                onChange={setAcknowledged}
              />
            )}

            <div className="sign-view__actions">
              <Button
                onClick={onReject}
                disabled={loading}
                variant="secondary"
                size="fill"
              >
                Reject
              </Button>
              <Button
                onClick={onApprove}
                disabled={approveDisabled}
                variant="primary"
                size="fill"
              >
                {loading ? 'Signing...' : 'Approve'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SignPopupAuthGate>
  )
}
