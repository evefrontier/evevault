import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const responsive = vi.hoisted(() => ({ isMobile: false, width: 1280 }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/wallet/settings' }),
}))

vi.mock('#/hooks', () => ({
  useResponsive: () => responsive,
}))

import { Layout } from '../Layout'
import { DEFAULT_TABBAR_HEIGHT } from '../NavigationBar/MobileBottomTabBar'

beforeEach(() => {
  responsive.isMobile = false
  responsive.width = 1280
})

describe('Layout navigation (web)', () => {
  it('shows the diamond rail beside the page on desktop', () => {
    render(<Layout>page</Layout>)

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('docks the same items at the bottom on phones', () => {
    responsive.isMobile = true
    responsive.width = 390
    render(<Layout>page</Layout>)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Home',
      'Transactions',
      'Address Aliases',
      'Settings',
    ])
    expect(screen.getByRole('tab', { name: /settings/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('keeps page content clear of the docked bar on phones', () => {
    responsive.isMobile = true
    responsive.width = 390
    render(<Layout>page</Layout>)

    const main = screen.getByRole('main')
    expect(
      Number.parseInt(main.style.paddingBottom, 10),
    ).toBeGreaterThanOrEqual(DEFAULT_TABBAR_HEIGHT)
  })
})
