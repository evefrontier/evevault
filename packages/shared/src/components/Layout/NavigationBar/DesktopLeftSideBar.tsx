import { Link, useLocation } from '@tanstack/react-router'
import type { NavigationBarProps } from '#/types'
import { DiamondTabContent } from './DiamondTab'
import './NavigationBar.css'

export default function DesktopLeftSideBar({ items }: NavigationBarProps) {
  const location = useLocation()

  return (
    <div className="side-rail">
      <img src="/images/logo.png" alt="EVE Vault" className="side-rail__logo" />

      <nav className="side-rail__nav">
        {items.map((item) => {
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.name}
              to={item.path}
              className="diamond-tab"
              aria-current={isActive ? 'page' : undefined}
            >
              <DiamondTabContent icon={item.icon} label={item.label} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
