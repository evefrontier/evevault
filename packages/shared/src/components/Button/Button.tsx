import type { FC, MouseEvent, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import './Button.css'
import { Corners } from '#/components/Corners'
import type { ButtonProps } from '#/types'

type ClickHandler = ButtonProps['onClick']

// Wraps onClick so a returned promise shows the spinner until it settles.
function useAsyncClickLoading(onClick: ClickHandler) {
  const [selfLoading, setSelfLoading] = useState(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleClick = onClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        const result = onClick(event) as unknown
        if (
          result != null &&
          typeof (result as PromiseLike<unknown>).then === 'function'
        ) {
          setSelfLoading(true)
          Promise.resolve(result).finally(() => {
            if (mountedRef.current) setSelfLoading(false)
          })
        }
      }
    : undefined

  return { selfLoading, handleClick }
}

// Tracks the element's rendered width, re-measured on window resize.
function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | undefined>()

  useEffect(() => {
    let rafId: number | null = null

    const updateWidth = () => {
      if (ref.current) {
        setWidth(ref.current.offsetWidth)
      }
    }

    // Initial measurement
    updateWidth()

    const handleResize = () => {
      // Use requestAnimationFrame for smooth, performant updates
      // This batches resize events and only updates once per frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(updateWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [ref])

  return width
}

export const Button: FC<ButtonProps> = ({
  size = 'medium',
  variant = 'primary',
  children,
  className = '',
  disabled,
  isLoading = false,
  onClick,
  ...props
}) => {
  const sizeClass = `button--${size}`
  const variantClass = `button--${variant}`

  const { selfLoading, handleClick } = useAsyncClickLoading(onClick)

  const loading = isLoading || selfLoading
  const isDisabled = disabled || loading
  const disabledClass = isDisabled ? 'button--disabled' : ''
  const showDecorations = variant === 'primary' || variant === 'secondary'

  const contentRef = useRef<HTMLSpanElement>(null)
  const contentWidth = useElementWidth(contentRef)

  return (
    <button
      className={`button ${sizeClass} ${variantClass} ${disabledClass} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {/* Main content */}
      <span ref={contentRef} className="button__content">
        {loading && <span className="button__spinner" aria-hidden="true" />}
        {children}
      </span>

      {showDecorations && (
        <>
          <Corners color="quantum" size={5} thickness={1} />

          {/* Edge lines */}
          <span className="button__edge-left" />
          <span className="button__edge-right" />

          {/* Hover overlay */}
          <span className="button__hover">
            <span
              className="button__hover-content"
              style={{ width: contentWidth }}
            >
              {children}
            </span>
          </span>
        </>
      )}
    </button>
  )
}

export default Button
