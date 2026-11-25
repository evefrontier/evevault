import type React from 'react'
import { useState } from 'react'
import Text from '#/components/Text'
import './PinCells.css'

const CELL_COUNT = 6

/**
 * Six PIN cells drawn over a single transparent password input, so typing,
 * pasting and autofill go through one native field.
 */
export function PinCells({
  value,
  onChange,
  errorText,
  label,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  errorText?: string
  label: string
}) {
  const [isFocused, setIsFocused] = useState(false)
  const filled = Math.min(value.length, CELL_COUNT)

  return (
    <div className="pin-cells">
      <div
        className={`pin-cells__row ${errorText ? 'pin-cells__row--error' : ''}`.trim()}
      >
        <input
          type="password"
          className="pin-cells__input"
          placeholder={label}
          aria-label={label}
          aria-invalid={errorText ? true : undefined}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {Array.from({ length: CELL_COUNT }, (_, index) => {
          const state =
            index < filled
              ? 'pin-cells__cell--filled'
              : isFocused && index === filled
                ? 'pin-cells__cell--current'
                : ''
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed cell positions
              key={index}
              className={`pin-cells__cell ${state}`.trim()}
              aria-hidden="true"
            >
              {index < filled ? <i className="pin-cells__dot" /> : null}
            </span>
          )
        })}
      </div>
      {errorText && (
        <Text size="small" color="error" className="input-error" role="alert">
          {errorText}
        </Text>
      )}
    </div>
  )
}
