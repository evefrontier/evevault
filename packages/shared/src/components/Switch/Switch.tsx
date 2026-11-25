import type React from 'react'
import type { SwitchProps } from '#/types'

const Switch: React.FC<SwitchProps> = ({
  isChecked,
  onChange,
  disabled,
  className = '',
  style,
}) => {
  const baseClasses = `w-[30px] h-4 inline-flex items-center justify-start p-[2px] bg-(--bg) border cursor-pointer ${
    isChecked ? 'border-(--brand)' : 'border-(--n30)'
  }`
  const disabledClasses = disabled ? 'opacity-60 cursor-default' : ''

  const thumbBaseClasses =
    'w-[10px] h-[10px] block transition-transform duration-200 ease-out'
  const thumbStateClasses = isChecked
    ? 'bg-(--brand) translate-x-[14px]'
    : 'bg-(--n50) translate-x-0'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      className={`${baseClasses} ${disabledClasses} ${className}`.trim()}
      style={style}
      onClick={() => onChange(!isChecked)}
      disabled={disabled}
    >
      <span className={`${thumbBaseClasses} ${thumbStateClasses}`} />
    </button>
  )
}

export default Switch
