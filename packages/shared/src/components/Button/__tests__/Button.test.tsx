import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Button', () => {
  it('applies size, variant and custom classes', () => {
    render(
      <Button size="small" variant="secondary" className="extra">
        Save
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('button', 'button--small', 'button--secondary')
    expect(button).toHaveClass('extra')
    expect(button).not.toBeDisabled()
  })

  it('renders hover decorations only for primary and secondary variants', () => {
    const { container, rerender } = render(<Button>Go</Button>)
    expect(container.querySelector('.button__hover')).not.toBeNull()

    rerender(<Button variant="text">Go</Button>)
    expect(container.querySelector('.button__hover')).toBeNull()
  })

  it('shows a spinner and disables while isLoading is set', () => {
    const { container } = render(<Button isLoading>Save</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveClass('button--disabled')
    expect(container.querySelector('.button__spinner')).not.toBeNull()
  })

  it('stays idle when onClick returns synchronously', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('shows loading until a returned promise settles', async () => {
    let resolveClick: () => void = () => {}
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClick = resolve
        }),
    )
    render(<Button onClick={onClick}>Save</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      resolveClick()
    })

    expect(screen.getByRole('button')).not.toBeDisabled()
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('does not update state when a pending click settles after unmount', async () => {
    let resolveClick: () => void = () => {}
    const onClick = () =>
      new Promise<void>((resolve) => {
        resolveClick = resolve
      })
    const consoleError = vi.spyOn(console, 'error')
    const { unmount } = render(<Button onClick={onClick}>Save</Button>)

    fireEvent.click(screen.getByRole('button'))
    unmount()
    await act(async () => {
      resolveClick()
    })

    expect(consoleError).not.toHaveBeenCalled()
  })

  it('sizes the hover content to the measured content width on resize', () => {
    let width = 80
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
      () => width,
    )
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame')
    const { container, unmount } = render(<Button>Save</Button>)

    const hoverContent = container.querySelector<HTMLElement>(
      '.button__hover-content',
    )
    expect(hoverContent?.style.width).toBe('80px')

    width = 120
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(hoverContent?.style.width).toBe('120px')

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)

    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2)
  })
})
