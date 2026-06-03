import type { SVGProps } from 'react'

type IconColorValue = 'color' | 'none' | string

type IconPath = {
  clipRule?: 'evenodd'
  d: string
  fill?: IconColorValue
  fillRule?: 'evenodd'
  stroke?: IconColorValue
  strokeWidth?: number
}

type IconOptions = {
  ariaLabel: string
  defaultColor?: string
  paths: IconPath[]
  svgFill?: IconColorValue
}

function resolveIconColor(value: IconColorValue | undefined, color: string) {
  if (value === 'color') return color
  return value
}

function getPathFill(path: IconPath, color: string) {
  if (path.fill !== undefined) return resolveIconColor(path.fill, color)
  if (path.stroke !== undefined) return undefined
  return color
}

export function createSvgIcon({
  ariaLabel,
  defaultColor = 'var(--neutral)',
  paths,
  svgFill = 'none',
}: IconOptions) {
  const SvgIcon = ({
    className,
    width = 16,
    height = 16,
    color = defaultColor,
  }: SVGProps<SVGSVGElement>) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill={resolveIconColor(svgFill, color)}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={ariaLabel}
      role="img"
    >
      {paths.map((path) => (
        <path
          key={path.d}
          d={path.d}
          fill={getPathFill(path, color)}
          fillRule={path.fillRule}
          clipRule={path.clipRule}
          stroke={resolveIconColor(path.stroke, color)}
          strokeWidth={path.strokeWidth}
        />
      ))}
    </svg>
  )

  return SvgIcon
}
