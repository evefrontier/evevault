import { useEffect, useState } from "react";

/**
 * Breakpoints for responsive design
 * - Mobile: < 768px (extension, phones)
 * - Tablet: 768px - 1024px
 * - Desktop: > 1024px
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export interface ResponsiveState {
  /** Screen width < 768px (extension, phones) */
  isMobile: boolean;
  /** Screen width 768px - 1024px */
  isTablet: boolean;
  /** Screen width > 1024px */
  isDesktop: boolean;
  /** Current screen width in pixels */
  width: number;
}

/**
 * Hook for responsive design across extension and web.
 * Provides breakpoint flags for mobile, tablet, and desktop.
 *
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop } = useResponsive();
 *
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * return <DesktopLayout />;
 * ```
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === "undefined") {
      return { isMobile: false, isTablet: false, isDesktop: true, width: 1200 };
    }
    return getResponsiveState(window.innerWidth);
  });

  useEffect(() => {
    const handleResize = () => {
      setState(getResponsiveState(window.innerWidth));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return state;
}

function getResponsiveState(width: number): ResponsiveState {
  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;

  return { isMobile, isTablet, isDesktop, width };
}
