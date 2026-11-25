import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Background from '#/components/Background'
import { useResponsive } from '#/hooks'
import { spacing } from '#/theme'
import type { LayoutProps } from '#/types'
import {
  calculateResponsivePadding,
  NAV_ITEMS,
  type PaddingConfig,
} from '#/utils'
import { HeaderMobile } from './Header/HeaderMobile'
import DesktopLeftSideBar from './NavigationBar/DesktopLeftSideBar'
import MobileBottomTabBar, {
  DEFAULT_TABBAR_HEIGHT,
} from './NavigationBar/MobileBottomTabBar'

/** Padding configuration for responsive layout */
const PADDING_CONFIG: PaddingConfig = {
  desktop: {
    top: spacing.xl, // 32px
    sides: spacing.xxl, // 48px
  },
  mobile: {
    minTop: spacing.lg, // 24px
    minHorizontal: spacing.md, // 16px
    topVh: 5, // 5vh
    horizontalVh: 4, // 4vh
  },
}
/** Extension popup content padding: 16px, with 24px at the bottom */
const EXTENSION_PADDING = {
  paddingTop: spacing.md,
  paddingLeft: spacing.md,
  paddingRight: spacing.md,
  paddingBottom: spacing.lg,
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  variant = 'web',
  showNav: _showNav = true, // Reserved for future mobile nav bar visibility
  headerProps,
}) => {
  const { width, isMobile } = useResponsive()
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 800
    return window.innerHeight
  })

  useEffect(() => {
    let rafId: number | null = null

    const handleResize = () => {
      // Use requestAnimationFrame for smooth, performant updates
      // This batches resize events and only updates once per frame (~60fps max)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => {
        setViewportHeight(window.innerHeight)
        rafId = null
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  // Calculate responsive padding that starts from desktop values and scales down smoothly
  // Memoize to avoid recalculating on every render (only recalculates when width/height change)
  const paddingStyle = useMemo(
    () => calculateResponsivePadding(width, viewportHeight, PADDING_CONFIG),
    [width, viewportHeight],
  )

  // Extension variant: compact layout for browser popup
  if (variant === 'extension') {
    return (
      <div className="layout--extension flex h-full w-full flex-col overflow-hidden">
        <Background fillViewport={false}>
          <div className="flex h-full flex-1 flex-col overflow-hidden">
            {/* Extension header */}
            {headerProps && (
              <HeaderMobile
                address={headerProps.address}
                email={headerProps.email}
                logoSrc={headerProps.logoSrc}
                onTransactionsClick={headerProps.onTransactionsClick}
              />
            )}
            {/* Scrollable content */}
            <main className="flex-1 overflow-y-auto" style={EXTENSION_PADDING}>
              {children}
            </main>
          </div>
        </Background>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar on tablet and desktop; the same items dock at the bottom on phones */}
      {isMobile ? (
        <MobileBottomTabBar items={NAV_ITEMS} />
      ) : (
        <DesktopLeftSideBar items={NAV_ITEMS} />
      )}

      {/* Main content area with background */}
      <Background>
        <div className="flex  flex-1 flex-col overflow-hidden h-full">
          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto"
            style={
              isMobile
                ? {
                    ...paddingStyle,
                    paddingBottom:
                      paddingStyle.paddingBottom + DEFAULT_TABBAR_HEIGHT,
                  }
                : paddingStyle
            }
          >
            {children}
          </main>
        </div>
      </Background>
    </div>
  )
}
