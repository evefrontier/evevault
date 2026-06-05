import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResponsive } from '#/hooks'

/**
 * Supports both controlled and uncontrolled dropdown usage so the same
 * component can be used in forms and in standalone extension menus.
 */
export function useDropdownOpenState({
  controlledIsOpen,
  onOpenChange,
}: {
  controlledIsOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = controlledIsOpen ?? internalIsOpen

  const setIsOpen = useCallback(
    (open: boolean) => {
      if (controlledIsOpen !== undefined) {
        onOpenChange?.(open)
        return
      }

      setInternalIsOpen(open)
    },
    [controlledIsOpen, onOpenChange],
  )

  return { isOpen, setIsOpen }
}

/**
 * Stores the latest outside-click callback in a ref so the document listener
 * can be installed once without closing over stale state.
 */
export function useOutsideClick(
  dropdownRef: React.RefObject<HTMLDivElement | null>,
  onClickOutside: () => void,
) {
  const onClickOutsideRef = useRef(onClickOutside)

  useEffect(() => {
    onClickOutsideRef.current = onClickOutside
  }, [onClickOutside])

  // biome-ignore lint/correctness/useExhaustiveDependencies: dropdownRef is stable; onClickOutsideRef keeps the callback fresh.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current?.contains(event.target as Node)) return
      onClickOutsideRef.current()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
}

/**
 * Measures the rendered menu after opening so the trigger corner decoration can
 * animate to the actual menu height instead of a hard-coded value.
 */
export function useMeasuredMenuHeight(isOpen: boolean) {
  const [menuHeight, setMenuHeight] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !menuRef.current) return
    setMenuHeight(menuRef.current.offsetHeight)
  }, [isOpen])

  return { menuHeight, menuRef }
}

/**
 * Uses the shared responsive width instead of CSS-only hiding because trigger
 * text affects both layout and corner animation behavior.
 */
export function useShowIconOnly() {
  const { width } = useResponsive()
  return width < 500
}
