import {
  Button,
  Checkbox,
  Heading,
  NetworkSelector,
  Text,
} from '@evevault/shared/components'
import type { DappRequestContext } from '@evevault/shared/types'
import { formatAddress } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import { type ReactNode, useState } from 'react'
import type { useSignPopupAuth } from '@/features/wallet/hooks'
import { SignPopupAuthGate } from './SignPopupAuthGate'

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

function ContextRow({
  label,
  value,
  title,
}: {
  label: string
  value: string
  title?: string
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 items-baseline">
      <span className="text-[10px] uppercase text-(--grey-neutral)">
        {label}
      </span>
      <span
        className="text-xs leading-4 text-(--neutral) truncate"
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  )
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
    <div className="w-[320px] max-w-[88vw] border border-(--matter-05) p-3">
      <div className="flex flex-col gap-2">
        {dapp && (
          <ContextRow label="Site" value={dapp.origin} title={dapp.url} />
        )}
        {accountAddress && (
          <ContextRow
            label="Account"
            value={formatAddress(accountAddress, 10, 8)}
            title={accountAddress}
          />
        )}
        {requestKind && <ContextRow label="Request" value={requestKind} />}
        {connectedAt && <ContextRow label="Connected" value={connectedAt} />}
      </div>
    </div>
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
  onApprove,
  onReject,
  children,
}: SignRequestViewProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  // Keep Approve disabled until the keeper's lock state is confirmed, so a stale
  // unlocked flag can't let the user fire a sign the keeper will reject.
  const approveDisabled =
    loading || !auth.lockChecked || (requireAcknowledgement && !acknowledged)
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
        <div className="flex flex-col items-center justify-between h-full">
          <div className="flex flex-col items-center justify-center gap-6">
            <img src="/images/logo.png" alt="EVE Vault" className="h-20" />
            <div className="flex flex-col items-center justify-center gap-3">
              <Heading level={2}>{title}</Heading>
              <RequestContextPanel
                dapp={dapp}
                accountAddress={accountAddress}
                requestKind={requestKind}
              />
              {children}
            </div>

            {error && (
              <div className="mb-5">
                <Text color="error">Error: {error}</Text>
              </div>
            )}

            {requireAcknowledgement && (
              <Checkbox
                name="acknowledge-risk"
                isChecked={acknowledged}
                isDisabled={loading}
                text={acknowledgementLabel}
                onChange={setAcknowledged}
                containerStyle={{ maxWidth: 320 }}
              />
            )}

            <div className="flex gap-2">
              <Button
                onClick={onApprove}
                disabled={approveDisabled}
                variant="primary"
              >
                {loading ? 'Signing...' : 'Approve'}
              </Button>

              <Button onClick={onReject} disabled={loading} variant="secondary">
                Reject
              </Button>
            </div>
          </div>
          {chain && (
            <NetworkSelector
              className="justify-start w-full items-end"
              chain={chain}
            />
          )}
        </div>
      )}
    </SignPopupAuthGate>
  )
}
