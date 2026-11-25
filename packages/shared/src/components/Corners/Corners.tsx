import type { CSSProperties } from 'react'
import type { CornersColor, CornersProps } from '#/types'

// Card corner tones: neutral-50/grey are the resting card, quantum is "on",
// wait is "wait" and error is "main".
const colorMap: Record<CornersColor, string> = {
  quantum: 'var(--brand-60)',
  'quantum-50': 'var(--brand-40)',
  neutral: 'var(--n60)',
  'neutral-50': 'var(--n20)',
  grey: 'var(--n20)',
  wait: 'rgba(255, 182, 81, 0.5)',
  error: 'var(--offline)',
  success: 'var(--relate)',
}
/// Has to be in a position:relative parent to work properly
export const Corners = ({
  color = 'quantum',
  size = 8,
  thickness = 1,
  className = '',
  style,
  bottomOffset,
  transition,
}: CornersProps) => {
  const cornerColor = colorMap[color]

  const baseCornerStyle: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    zIndex: 1,
    ...(transition && { transition }),
  }

  const lineStyle: CSSProperties = {
    content: '""',
    position: 'absolute',
    background: cornerColor,
  }

  const horizontalLine: CSSProperties = {
    ...lineStyle,
    width: size,
    height: thickness,
  }

  const verticalLine: CSSProperties = {
    ...lineStyle,
    width: thickness,
    height: size,
  }

  return (
    <>
      {/* Top-left corner */}
      <span
        className={`corners corners__corner corners__corner--tl ${className}`}
        style={{ ...baseCornerStyle, left: 0, top: 0, ...style }}
      >
        <span style={{ ...horizontalLine, left: 0, top: 0 }} />
        <span style={{ ...verticalLine, left: 0, top: 0 }} />
      </span>

      {/* Top-right corner */}
      <span
        className={`corners corners__corner corners__corner--tr ${className}`}
        style={{ ...baseCornerStyle, right: 0, top: 0, ...style }}
      >
        <span style={{ ...horizontalLine, right: 0, top: 0 }} />
        <span style={{ ...verticalLine, right: 0, top: 0 }} />
      </span>

      {/* Bottom-left corner */}
      <span
        className={`corners corners__corner corners__corner--bl ${className}`}
        style={{
          ...baseCornerStyle,
          left: 0,
          bottom: bottomOffset ? -bottomOffset : 0,
          ...style,
        }}
      >
        <span style={{ ...horizontalLine, left: 0, bottom: 0 }} />
        <span style={{ ...verticalLine, left: 0, bottom: 0 }} />
      </span>

      {/* Bottom-right corner */}
      <span
        className={`corners corners__corner corners__corner--br ${className}`}
        style={{
          ...baseCornerStyle,
          right: 0,
          bottom: bottomOffset ? -bottomOffset : 0,
          ...style,
        }}
      >
        <span style={{ ...horizontalLine, right: 0, bottom: 0 }} />
        <span style={{ ...verticalLine, right: 0, bottom: 0 }} />
      </span>
    </>
  )
}

export default Corners
