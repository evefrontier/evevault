import type { ReactNode } from 'react'

interface BackgroundProps {
  children: ReactNode
  bottomOffset?: number
  /** When false, fills the parent instead of at least the viewport height */
  fillViewport?: boolean
}

const Background = ({
  children,
  bottomOffset = 0,
  fillViewport = true,
}: BackgroundProps) => {
  return (
    <div
      className={`relative h-full w-full flex-1 overflow-hidden ${fillViewport ? 'min-h-screen' : 'min-h-0'}`}
      style={{
        backgroundColor: 'var(--bg)',
        paddingBottom: bottomOffset,
      }}
    >
      {children}
    </div>
  )
}

export default Background
