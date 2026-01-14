import { useResponsive } from "@evevault/shared/hooks";
import type { LayoutProps } from "@evevault/shared/types";
import type React from "react";
import { NAV_ITEMS } from "../../utils/routes";
import Background from "../Background";
import DesktopLeftSideBar from "./NavigationBar/DesktopLeftSideBar";
import MobileBottomTabBar from "./NavigationBar/MobileBottomTabBar";

/** Grid margin: mobile top/bottom 24px, left/right 16px; desktop 40px all sides */
const GRID_MARGIN = { mobile: { vertical: 24, horizontal: 16 }, default: 40 };
/** Mobile nav bar height */
const MOBILE_NAV_HEIGHT = 64;

export const Layout: React.FC<LayoutProps> = ({ children, showNav = true }) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const showMobileNav = isMobile && showNav;
  /// TODO: add sidebar
  const showSidebar = false;

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
    <div className="flex h-full min-h-screen w-full min-w-screen overflow-hidden">
      {/* Sidebar - visible on tablet and desktop */}
      {showSidebar && <DesktopLeftSideBar items={NAV_ITEMS} />}

      {/* Main content area with background */}
      <Background bottomOffset={showMobileNav ? MOBILE_NAV_HEIGHT : 0}>
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto"
            style={paddingStyle}
          >
            {children}
          </main>
        </div>
      </Background>

      {/* Mobile Bottom Tab Bar */}
      {showMobileNav && <MobileBottomTabBar items={NAV_ITEMS} />}
    </div>
  );
};
