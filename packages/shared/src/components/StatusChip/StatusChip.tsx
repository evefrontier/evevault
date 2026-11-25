import type { ReactNode } from 'react'

/** `on` brand, `wait` amber, `off` red, `idle` unlit. */
export type LampTone = 'on' | 'wait' | 'off' | 'idle'

/** Square status lamp. */
export function Lamp({ tone = 'idle' }: { tone?: LampTone }) {
  const modifier = tone === 'idle' ? '' : ` c-lamp--${tone}`
  return <span className={`c-lamp${modifier}`} aria-hidden="true" />
}

/** Static chip with a lamp, e.g. "Locked" or "Signed out". */
export function StatusChip({
  lamp = 'idle',
  children,
}: {
  lamp?: LampTone
  children: ReactNode
}) {
  return (
    <span className="c-chip">
      <Lamp tone={lamp} />
      {children}
    </span>
  )
}

export default StatusChip
