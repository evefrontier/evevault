import type React from 'react'
import type { TextProps } from '#/types'

// Size classes for regular text
const sizeClasses: Record<string, string> = {
  xsmall: 'text-xs leading-4 tracking-[-0.02em]',
  small: 'text-sm leading-5 tracking-[-0.02em]',
  medium: 'text-sm leading-5 tracking-[-0.02em]',
  large: 'text-base leading-[22px] tracking-[-0.02em]',
}

// Weight classes for regular variants: Favorit 300 body, 400 for emphasis
const variantClasses: Record<string, string> = {
  light: 'font-extralight',
  regular: 'font-light',
  bold: 'font-normal',
  secondary: 'font-light',
}

// Label variants are complete styles (include size, weight, etc.): Disket caps
const labelClasses: Record<string, string> = {
  label: 'text-[11px] leading-[1.3] font-normal uppercase tracking-[0.1em]',
  'label-semi':
    'text-[11px] leading-[1.3] font-normal uppercase tracking-[0.08em]',
  'label-medium':
    'text-xs leading-[1.3] font-normal uppercase tracking-[0.08em]',
  'label-small':
    'text-[10px] leading-[1.2] font-normal uppercase tracking-[0.09em]',
}

// Label variants that use headline font
const headlineLabelVariants = [
  'label',
  'label-semi',
  'label-medium',
  'label-small',
]

const Text: React.FC<TextProps> = ({
  size = 'medium',
  variant = 'regular',
  color = 'neutral',
  className = '',
  children,
  style,
  ...rest
}) => {
  const isLabel = variant.startsWith('label')
  const useHeadlineFont = headlineLabelVariants.includes(variant)

  const textClasses = isLabel
    ? labelClasses[variant] || labelClasses.label
    : `${sizeClasses[size]} ${variantClasses[variant]}`

  const computedClassName = `${textClasses} ${className}`.trim()

  // Fonts are CSS variables from global.css, applied via inline style
  const fontFamily = useHeadlineFont
    ? 'var(--font-headline)'
    : 'var(--font-body)'

  const computedStyle: React.CSSProperties = {
    fontFamily,
    color: color ? `var(--${color})` : undefined,
    ...style,
  }

  return (
    <p className={computedClassName} style={computedStyle} {...rest}>
      {children}
    </p>
  )
}

export default Text
