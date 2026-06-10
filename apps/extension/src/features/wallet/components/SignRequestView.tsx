import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from '@evevault/shared/components'
import type { DappRequestContext } from '@evevault/shared/types'
import type { SuiChain } from '@mysten/wallet-standard'
import type { ReactNode } from 'react'
import type { useSignPopupAuth } from '@/features/wallet/hooks'
import { SignPopupAuthGate } from './SignPopupAuthGate'

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
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
  children: ReactNode
}

function shortenMiddle(value: string): string {
  if (value.length <= 22) return value
  return `${value.slice(0, 10)}...${value.slice(-8)}`
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
      <span className="text-[10px] uppercase text-[var(--grey-neutral)]">
        {label}
      </span>
      <span
        className="text-xs leading-4 text-[var(--neutral)] truncate"
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
    <div className="w-[320px] max-w-[88vw] border border-[var(--quantum-60)] bg-[var(--crude-dark)] p-3 text-left">
      <div className="flex flex-col gap-2">
        {dapp && (
          <ContextRow label="Site" value={dapp.origin} title={dapp.url} />
        )}
        {accountAddress && (
          <ContextRow
            label="Account"
            value={shortenMiddle(accountAddress)}
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
  onApprove,
  onReject,
  children,
}: SignRequestViewProps) {
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
              <div style={{ marginBottom: '20px' }}>
                <Text color="error">Error: {error}</Text>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={onApprove} disabled={loading} variant="primary">
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
