import type { ReactNode } from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import { SignInContextLine } from '#/components/SignInContextLine'
import type { TenantSelectorProps } from '#/types'
import { AuthMark, AuthShell, DevModeStrip, DevModeToggle } from './AuthShell'

/** Signed-out screen shared by web and the extension popup. */
export function SignInView({
  loading,
  onLogin,
  tenant,
  devMode,
  onDevModeToggle,
  notice,
  footerStart,
  children,
}: {
  loading: boolean
  onLogin: () => void | Promise<void>
  tenant: TenantSelectorProps
  devMode: boolean
  onDevModeToggle: () => void
  /** Text under the heading, e.g. why the session ended */
  notice?: ReactNode
  /** Left side of the footer, e.g. a "Reset vault" link */
  footerStart?: ReactNode
  /** Rendered after the body, e.g. a confirmation dialog */
  children?: ReactNode
}) {
  return (
    <AuthShell
      status="Signed out"
      strip={devMode && <DevModeStrip>Every server is listed</DevModeStrip>}
      footer={
        <>
          {footerStart}
          {/* Stays visible while signed out so testers can switch servers
              and localnet before starting auth */}
          <DevModeToggle devMode={devMode} onClick={onDevModeToggle} />
        </>
      }
    >
      <AuthMark variant="vault" />
      <header className="flex flex-col items-center gap-2 text-center">
        <Heading level={2}>Sign in</Heading>
        {notice}
      </header>
      <div className="w-full max-w-[288px]">
        <Button size="fill" onClick={onLogin} disabled={loading}>
          {loading ? 'Loading...' : 'Login'}
        </Button>
      </div>
      <SignInContextLine tenant={tenant} />
      {children}
    </AuthShell>
  )
}

export default SignInView
