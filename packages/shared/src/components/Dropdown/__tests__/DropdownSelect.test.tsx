import { act, render, renderHook, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDropdownOpenState } from '../DropdownSelect.helpers'
import { DropdownSelectMenu } from '../DropdownSelect.parts'

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
