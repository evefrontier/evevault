import { useResponsive } from "@evevault/shared/hooks";
import type { LayoutProps } from "@evevault/shared/types";
import type React from "react";
import { NAV_ITEMS } from "../../utils/routes";
import Background from "../Background";
import { HeaderMobile } from "./Header/HeaderMobile";
import DesktopLeftSideBar from "./NavigationBar/DesktopLeftSideBar";
import MobileBottomTabBar from "./NavigationBar/MobileBottomTabBar";

/** Grid margin: mobile top/bottom 24px, left/right 16px; desktop 40px all sides */
const GRID_MARGIN = { mobile: { vertical: 24, horizontal: 16 }, default: 40 };
/** Extension popup margins: py-24px, px-16px (from Figma) */
const EXTENSION_MARGIN = { vertical: 24, horizontal: 16 };
/** Gap between header and content in extension (from Figma) */
const EXTENSION_CONTENT_GAP = 40;
/** Mobile nav bar height */
const MOBILE_NAV_HEIGHT = 64;

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
