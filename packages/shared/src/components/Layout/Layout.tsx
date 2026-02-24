import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useResponsive } from "../../hooks";
import { spacing } from "../../theme";
import type { LayoutProps } from "../../types";
import {
  calculateResponsivePadding,
  NAV_ITEMS,
  type PaddingConfig,
} from "../../utils";
import Background from "../Background";
import { HeaderMobile } from "./Header/HeaderMobile";
import DesktopLeftSideBar from "./NavigationBar/DesktopLeftSideBar";

/** Padding configuration for responsive layout */
const PADDING_CONFIG: PaddingConfig = {
  desktop: {
    top: spacing.xs * 30, // 120px
    sides: spacing.xxl, // 48px
  },
  mobile: {
    minTop: spacing.lg, // 24px
    minHorizontal: spacing.md, // 16px
    topVh: 5, // 5vh
    horizontalVh: 4, // 4vh
  },
};
/** Extension popup margins: py-24px (6 * 4px), px-16px (4 * 4px) */
const EXTENSION_MARGIN = { vertical: spacing.lg, horizontal: spacing.md };
/** Gap between header and content in extension: 40px (10 * 4px) */
const EXTENSION_CONTENT_GAP = spacing.xxl - spacing.sm;

export const Layout: React.FC<LayoutProps> = ({
  children,
  variant = "web",
  showNav: _showNav = true, // Reserved for future mobile nav bar visibility
  headerProps,
}) => {
  const { width } = useResponsive();
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 800;
    return window.innerHeight;
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      // Use requestAnimationFrame for smooth, performant updates
      // This batches resize events and only updates once per frame (~60fps max)
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        setViewportHeight(window.innerHeight);
        rafId = null;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Calculate responsive padding that starts from desktop values and scales down smoothly
  // Memoize to avoid recalculating on every render (only recalculates when width/height change)
  const paddingStyle = useMemo(
    () => calculateResponsivePadding(width, viewportHeight, PADDING_CONFIG),
    [width, viewportHeight],
  );

  // Extension variant: compact layout for browser popup
  if (variant === "extension") {
    const extensionPaddingStyle = {
      paddingTop: EXTENSION_MARGIN.vertical,
      paddingBottom: EXTENSION_MARGIN.vertical,
      paddingLeft: EXTENSION_MARGIN.horizontal,
      paddingRight: EXTENSION_MARGIN.horizontal,
    };

    return (
      <div className="flex h-full min-h-screen w-full flex-col overflow-hidden">
        <Background>
          <div
            className="flex h-full flex-1 flex-col overflow-hidden"
            style={{ ...extensionPaddingStyle, gap: EXTENSION_CONTENT_GAP }}
          >
            {/* Extension header */}
            {headerProps && (
              <HeaderMobile
                address={headerProps.address}
                email={headerProps.email}
                logoSrc={headerProps.logoSrc}
                identicon={headerProps.identicon}
                onTransactionsClick={headerProps.onTransactionsClick}
              />
            )}
            {/* Scrollable content */}
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </Background>
      </div>
    );
  }

  /// TODO: add sidebar
  const showSidebar = false;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar - visible on tablet and desktop */}
      {showSidebar && <DesktopLeftSideBar items={NAV_ITEMS} />}

      {/* Main content area with background */}
      <Background>
        <div className="flex  flex-1 flex-col overflow-hidden h-full">
          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto"
            style={paddingStyle}
          >
            {children}
          </main>
        </div>
      </Background>
    </div>
  );
};
