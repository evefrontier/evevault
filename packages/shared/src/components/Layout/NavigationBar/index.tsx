import { useResponsive } from "src/hooks/useResponsive";
import type { NavigationBarProps } from "../../../types";
import DesktopLeftSideBar from "./DesktopLeftSideBar";
import MobileBottomTabBar from "./MobileBottomTabBar";

export default function NavigationBar(props: NavigationBarProps) {
  const { isMobile } = useResponsive();
  if (isMobile) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
