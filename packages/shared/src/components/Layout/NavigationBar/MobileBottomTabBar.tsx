import type { IconName, NavigationBarProps } from "@evevault/shared/types";
import { Link, useLocation } from "@tanstack/react-router";
import Icon from "../../Icon";
import Text from "../../Text";

export const DEFAULT_TABBAR_HEIGHT = 64;

export default function MobileBottomTabBar({ items }: NavigationBarProps) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex  items-center justify-around border-t border-[var(--matter-04)] bg-[var(--crude)]">
      {items.map((item) => {
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.name}
            to={item.path}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3.5"
            role="tab"
            aria-selected={isActive}
          >
            <Icon
              name={item.icon as IconName}
              size="medium"
              color={isActive ? "neutral" : "grey-neutral"}
            />
            <Text
              size="small"
              variant="label-semi"
              color={isActive ? "neutral" : "grey-neutral"}
              className="text-[10px] uppercase tracking-wider"
            >
              {item.label}
            </Text>
          </Link>
        );
      })}
    </nav>
  );
}
