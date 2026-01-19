import { Link, useLocation } from "@tanstack/react-router";
import type { IconName, NavigationBarProps } from "../../../types";
import { Corners } from "../../Corners";
import Icon from "../../Icon";
import Text from "../../Text";

export default function DesktopLeftSideBar({ items }: NavigationBarProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen w-56 flex-col bg-[var(--crude)]">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-8 pb-40">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const isActive = location.pathname === item.path;

          const linkContent = (
            <Link
              to={item.path}
              className={`flex w-full items-center gap-4 px-10 py-6 transition-colors ${
                isActive
                  ? "bg-[var(--quantum-50)]"
                  : "hover:bg-[var(--quantum-10)]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                name={item.icon as IconName}
                size="medium"
                color={isActive ? "neutral" : "matter-06"}
              />
              <Text
                variant="label-semi"
                color={isActive ? "neutral" : "matter-06"}
                className="uppercase"
              >
                {item.label}
              </Text>
            </Link>
          );

          return (
            <div key={item.name} className="relative">
              {isActive && (
                <Corners color="neutral-50" size={5} thickness={1} />
              )}
              {linkContent}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
