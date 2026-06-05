import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DropdownSelect } from '../DropdownSelect'
import {
  useDropdownOpenState,
  useShowIconOnly,
} from '../DropdownSelect.helpers'
import { DropdownSelectMenu } from '../DropdownSelect.parts'

const mockResponsive = vi.hoisted(() => ({
  width: 800,
}))

vi.mock('#/hooks', () => ({
  useResponsive: () => ({ width: mockResponsive.width }),
}))

describe('DropdownSelectMenu', () => {
  it('falls back to items when children is an empty string', () => {
    render(
      <DropdownSelectMenu
        items={[{ label: 'Testnet', onClick: vi.fn() }]}
        menuRef={createRef<HTMLDivElement>()}
        onItemClick={vi.fn()}
      >
        {''}
      </DropdownSelectMenu>,
    )

    expect(screen.getByText('Testnet')).toBeInTheDocument()
  })

  it('activates a menu item with the Enter key', () => {
    const onClick = vi.fn()
    render(
      <DropdownSelectMenu
        items={[{ label: 'Devnet', onClick }]}
        menuRef={createRef<HTMLDivElement>()}
        onItemClick={(item) => item.onClick()}
      />,
    )

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Devnet' }), {
      key: 'Enter',
    })

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('useDropdownOpenState', () => {
  it('updates internal state in uncontrolled mode', () => {
    const { result } = renderHook(() => useDropdownOpenState({}))

    act(() => {
      result.current.setIsOpen(true)
    })

    expect(result.current.isOpen).toBe(true)
  })

  it('delegates state changes in controlled mode', () => {
    const onOpenChange = vi.fn()
    const { result } = renderHook(() =>
      useDropdownOpenState({
        controlledIsOpen: false,
        onOpenChange,
      }),
    )

    act(() => {
      result.current.setIsOpen(true)
    })

    expect(result.current.isOpen).toBe(false)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

describe('useShowIconOnly', () => {
  it('switches to icon-only mode below the mobile breakpoint', () => {
    mockResponsive.width = 320

    const { result } = renderHook(() => useShowIconOnly())

    expect(result.current).toBe(true)
  })
})

describe('DropdownSelect', () => {
  beforeEach(() => {
    mockResponsive.width = 800
  })

  afterEach(() => {
    cleanup()
  })

  it('opens, runs an item action, and closes by default', () => {
    const onClick = vi.fn()
    render(
      <DropdownSelect
        trigger="Selected network"
        items={[{ label: 'Devnet', onClick }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /selected network/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Devnet' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('menuitem', { name: 'Devnet' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the menu open when an item prevents close on click', () => {
    const onClick = vi.fn()
    render(
      <DropdownSelect
        trigger="Selected network"
        items={[{ label: 'Stay open', onClick, preventCloseOnClick: true }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /selected network/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stay open' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('menuitem', { name: 'Stay open' }),
    ).toBeInTheDocument()
  })

  it('reports controlled close requests from outside clicks', () => {
    const onOpenChange = vi.fn()
    render(
      <DropdownSelect
        trigger="Selected network"
        isOpen
        onOpenChange={onOpenChange}
        items={[{ label: 'Devnet', onClick: vi.fn() }]}
      />,
    )

    fireEvent.mouseDown(document.body)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('measures the menu height after opening', async () => {
    const previousOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    )

    try {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        value: 42,
      })

      const { container } = render(
        <DropdownSelect
          trigger="Selected network"
          isOpen
          items={[{ label: 'Devnet', onClick: vi.fn() }]}
        />,
      )

      await waitFor(() => {
        expect(
          (container.firstElementChild as HTMLElement).style.getPropertyValue(
            '--menu-height',
          ),
        ).toBe('42px')
      })
    } finally {
      if (previousOffsetHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetHeight',
          previousOffsetHeight,
        )
      }
    }
  })
})
