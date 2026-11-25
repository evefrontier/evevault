import { Link, useLocation } from '@tanstack/react-router'
import type { NavigationBarProps } from '#/types'
import { DiamondTabContent } from './DiamondTab'
import './NavigationBar.css'

export const DEFAULT_TABBAR_HEIGHT = 84

export default function MobileBottomTabBar({ items }: NavigationBarProps) {
  const location = useLocation()

  return (
    <nav className="tab-dock">
      {items.map((item) => {
        const isActive = location.pathname === item.path

        return (
          <Link
            key={item.name}
            to={item.path}
            className="diamond-tab"
            role="tab"
            aria-selected={isActive}
          >
            <DiamondTabContent icon={item.icon} label={item.label} />
          </Link>
        )
      })}
    </nav>
  )
}
