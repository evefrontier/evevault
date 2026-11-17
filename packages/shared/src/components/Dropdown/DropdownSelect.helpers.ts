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

const MENU_VIEWPORT_MARGIN_PX = 8
const MENU_MIN_HEIGHT_PX = 96

/**
 * Returns the smallest of the window bottom, the page body bottom, and the
 * client-area bottom of the element's nearest clipping or scrolling ancestor.
 */
function getVisibleBottom(element: HTMLElement) {
  let visibleBottom = Math.min(
    window.innerHeight,
    document.body.getBoundingClientRect().bottom,
  )

  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== document.body;
    ancestor = ancestor.parentElement
  ) {
    if (getComputedStyle(ancestor).overflowY === 'visible') continue
    const clientBottom =
      ancestor.getBoundingClientRect().top +
      ancestor.clientTop +
      ancestor.clientHeight
    visibleBottom = Math.min(visibleBottom, clientBottom)
    break
  }

  return visibleBottom
}

/**
 * Sets the menu's max height to the space between its top and the visible
 * bottom, minus a margin, with a floor of the smaller of MENU_MIN_HEIGHT_PX
 * and its content height, then stores its rendered height. Runs when the menu
 * opens, when the item count changes while open, and on window resize while
 * open.
 */
export function useMeasuredMenuHeight(isOpen: boolean, itemCount = 0) {
  const [menuHeight, setMenuHeight] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemCount triggers re-measuring when items change while open.
  useEffect(() => {
    const menu = menuRef.current
    if (!isOpen || !menu) return

    const measure = () => {
      const availableHeight =
        getVisibleBottom(menu) -
        menu.getBoundingClientRect().top -
        MENU_VIEWPORT_MARGIN_PX
      const minHeight = Math.min(menu.scrollHeight, MENU_MIN_HEIGHT_PX)
      menu.style.maxHeight = `${Math.max(availableHeight, minHeight)}px`
      setMenuHeight(menu.offsetHeight)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isOpen, itemCount])

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
