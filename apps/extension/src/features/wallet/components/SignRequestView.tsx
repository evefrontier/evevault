import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from '@evevault/shared/components'
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
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
  children: ReactNode
}

export function SignRequestView({
  auth,
  title,
  hasPending,
  loading,
  error,
  loadingMessage,
  chain,
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
          <div className="flex flex-col items-center justify-center gap-10">
            <img src="/images/logo.png" alt="EVE Vault" className="h-20" />
            <div className="flex flex-col items-center justify-center gap-4">
              <Heading level={2}>{title}</Heading>
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
