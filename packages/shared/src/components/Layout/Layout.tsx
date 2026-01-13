import { useResponsive } from "@evevault/shared/hooks";
import { spacing } from "@evevault/shared/theme";
import type { LayoutProps } from "@evevault/shared/types";
import type React from "react";
import { NAV_ITEMS } from "../../utils/routes";
import Background from "../Background";
import { HeaderMobile } from "./Header/HeaderMobile";
import DesktopLeftSideBar from "./NavigationBar/DesktopLeftSideBar";
import MobileBottomTabBar from "./NavigationBar/MobileBottomTabBar";

/** Grid margin: mobile top/bottom 24px (6 * 4px), left/right 16px (4 * 4px); desktop 40px (10 * 4px) all sides */
const GRID_MARGIN = {
  mobile: { vertical: spacing.lg, horizontal: spacing.md },
  default: spacing.xxl - spacing.sm,
};
/** Extension popup margins: py-24px (6 * 4px), px-16px (4 * 4px) */
const EXTENSION_MARGIN = { vertical: spacing.lg, horizontal: spacing.md };
/** Gap between header and content in extension: 40px (10 * 4px) */
const EXTENSION_CONTENT_GAP = spacing.xxl - spacing.sm;
/** Mobile nav bar height: 64px (16 * 4px) */
const MOBILE_NAV_HEIGHT = spacing.xs * 16;

export const Layout: React.FC<LayoutProps> = ({
  children,
  variant = "web",
  showNav = true,
  headerProps,
}) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();

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

  // Web variant: full layout with sidebar/bottom nav
  const showMobileNav = isMobile && showNav;
  const showSidebar = (isTablet || isDesktop) && showNav;

  const paddingStyle = isMobile
    ? {
        paddingTop: GRID_MARGIN.mobile.vertical,
        paddingBottom: showMobileNav ? 80 : GRID_MARGIN.mobile.vertical,
        paddingLeft: GRID_MARGIN.mobile.horizontal,
        paddingRight: GRID_MARGIN.mobile.horizontal,
      }
    : {
        padding: GRID_MARGIN.default,
        paddingBottom: showMobileNav ? 80 : GRID_MARGIN.default,
      };

  return (
    <div className="flex h-full min-h-screen w-full overflow-hidden">
      {/* Sidebar - visible on tablet and desktop */}
      {showSidebar && <DesktopLeftSideBar items={NAV_ITEMS} />}

      {/* Main content area with background */}
      <Background bottomOffset={showMobileNav ? MOBILE_NAV_HEIGHT : 0}>
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto" style={paddingStyle}>
            {children}
          </main>
        </div>
      </Background>

      {/* Mobile Bottom Tab Bar */}
      {showMobileNav && <MobileBottomTabBar items={NAV_ITEMS} />}
    </div>
  );
};
