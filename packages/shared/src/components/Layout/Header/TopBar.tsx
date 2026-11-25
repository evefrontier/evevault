import type { ReactNode } from 'react'
import { Lamp, type LampTone } from '#/components/StatusChip'
import './HeaderMobile.css'

/** 48px bar with the logo on the left, `end` on the right, then an optional strip. */
export function TopBar({
  end,
  strip,
  flush = false,
  logoSrc = '/images/logo.png',
}: {
  end?: ReactNode
  strip?: ReactNode
  /** Drops the 16px gap below the bar, for full-height frames */
  flush?: boolean
  logoSrc?: string
}) {
  return (
    <header className={`app-topbar${flush ? ' app-topbar--flush' : ''}`}>
      <div className="app-topbar__bar">
        <img src={logoSrc} alt="EVE Vault" className="app-topbar__logo" />
        {end && <div className="app-topbar__group">{end}</div>}
      </div>
      {strip}
    </header>
  )
}

/** Notice row under the top bar: lamp, caps label, then text. */
export function TopBarStrip({
  label,
  lamp,
  tone = 'default',
  children,
}: {
  label: string
  lamp?: LampTone
  /** `dev` amber tint, `approval` brand tint */
  tone?: 'default' | 'dev' | 'approval'
  children?: ReactNode
}) {
  const modifier = tone === 'default' ? '' : ` app-topbar__strip--${tone}`
  return (
    <div className={`app-topbar__strip${modifier}`}>
      {lamp && <Lamp tone={lamp} />}
      <b>{label}</b>
      {children}
    </div>
  )
}

export default TopBar
