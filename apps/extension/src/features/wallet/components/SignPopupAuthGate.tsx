import {
  AuthMark,
  AuthShell,
  Button,
  Heading,
  Text,
} from '@evevault/shared/components'
import { LockScreen } from '@evevault/shared/screens'
import type { User } from 'oidc-client-ts'
import type { ReactNode } from 'react'
import { APP_VERSION } from '@/lib/appVersion'
import './SignRequestView.css'

export interface SignPopupAuthGateProps {
  isLocked: boolean
  isPinSet: boolean
  unlock: (pin: string) => Promise<void>
  user: User | null
  loading: boolean
  login: () => Promise<User | undefined>
  title: string
  onCancel: () => void
  cancelDisabled?: boolean
  children: ReactNode
}

/**
 * Renders lock screen when vault is locked, login prompt when unauthenticated,
 * or children when unlocked and authenticated.
 */
export function SignPopupAuthGate({
  isLocked,
  isPinSet,
  unlock,
  user,
  loading,
  login,
  title,
  onCancel,
  cancelDisabled = false,
  children,
}: SignPopupAuthGateProps) {
  if (isLocked) {
    return (
      <LockScreen isPinSet={isPinSet} unlock={unlock} version={APP_VERSION} />
    )
  }

  if (!user) {
    return (
      <AuthShell status="Signed out">
        <AuthMark variant="vault" />
        <header className="flex flex-col items-center gap-2 text-center">
          <Heading level={2}>{title}</Heading>
          <Text variant="light" color="n60">
            You need to log in before signing.
          </Text>
        </header>
        <div className="sign-view__actions w-full max-w-[320px]">
          <Button
            onClick={onCancel}
            disabled={cancelDisabled}
            variant="secondary"
            size="fill"
          >
            Cancel
          </Button>
          <Button
            onClick={() => login()}
            disabled={loading}
            variant="primary"
            size="fill"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </div>
      </AuthShell>
    )
  }

  return <>{children}</>
}
