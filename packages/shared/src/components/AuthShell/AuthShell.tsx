import type { ReactNode } from 'react'
import { TopBar, TopBarStrip } from '#/components/Layout/Header/TopBar'
import { type LampTone, StatusChip } from '#/components/StatusChip'
import './AuthShell.css'

/** Full-height frame: top bar with a status chip, optional strip, centred body, footer. */
export function AuthShell({
  status,
  lamp = 'idle',
  strip,
  footer,
  children,
}: {
  /** Status chip text, e.g. "Locked" or "Signed out" */
  status: string
  lamp?: LampTone
  /** Notice row under the top bar */
  strip?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="auth-shell">
      <TopBar
        flush
        end={<StatusChip lamp={lamp}>{status}</StatusChip>}
        strip={strip}
      />
      <section className="auth-shell__body">{children}</section>
      {footer && <footer className="auth-shell__footer">{footer}</footer>}
    </div>
  )
}

/** Amber strip shown under the top bar while dev mode is on. */
export function DevModeStrip({ children }: { children: ReactNode }) {
  return (
    <TopBarStrip label="Dev mode" lamp="wait" tone="dev">
      {children}
    </TopBarStrip>
  )
}

/** Footer toggle for dev mode; amber while on. */
export function DevModeToggle({
  devMode,
  onClick,
}: {
  devMode: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="auth-shell__dev"
      aria-pressed={devMode}
      onClick={onClick}
    >
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <path d="M1.5 7S3.8 3 7 3s5.5 4 5.5 4-2.3 4-5.5 4-5.5-4-5.5-4Z" />
        {devMode ? <circle cx="7" cy="7" r="1.8" /> : <path d="M2 12 12 2" />}
      </svg>
      Dev mode
    </button>
  )
}

/** Dotted-underline text button used for footer links such as "Reset vault". */
export function AuthShellLink({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className="auth-shell__link" onClick={onClick}>
      {children}
    </button>
  )
}

/** Large diamond mark: nested diamonds for sign-in, a padlock for locked. */
export function AuthMark({ variant }: { variant: 'vault' | 'lock' }) {
  return (
    <svg viewBox="0 0 80 80" className="auth-shell__icon" aria-hidden="true">
      <path className="auth-shell__icon-frame" d="M40 5 75 40 40 75 5 40Z" />
      {variant === 'lock' ? (
        <path d="M33 39h14v12H33zM35.5 39v-4a4.5 4.5 0 0 1 9 0v4M40 43.5v3" />
      ) : (
        <>
          <path d="M40 18 62 40 40 62 18 40Z" />
          <path
            className="auth-shell__icon-core"
            d="M40 32 48 40 40 48 32 40Z"
          />
        </>
      )}
    </svg>
  )
}

/** App version, right-aligned in an AuthShell footer. */
export function AuthShellVersion({ version }: { version: string }) {
  return <span className="auth-shell__version">v{version}</span>
}

export default AuthShell
