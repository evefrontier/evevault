import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResponsive } from '#/hooks'

export function useDropdownOpenState({
  controlledIsOpen,
  onOpenChange,
}: {
  controlledIsOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

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

export function useOutsideClick(
  dropdownRef: React.RefObject<HTMLDivElement | null>,
  onClickOutside: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current?.contains(event.target as Node)) return
      onClickOutside()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownRef, onClickOutside])
}

export function useMeasuredMenuHeight(isOpen: boolean) {
  const [menuHeight, setMenuHeight] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !menuRef.current) return
    setMenuHeight(menuRef.current.offsetHeight)
  }, [isOpen])

  return { menuHeight, menuRef }
}

export function useShowIconOnly() {
  const { width } = useResponsive()
  return width < 500
}
