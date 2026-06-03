import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getIdenticon } from '../Identicons'

describe('getIdenticon', () => {
  it('renders an SVG identicon with one rect per pattern cell', () => {
    const { container } = render(getIdenticon(0))

    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelectorAll('rect')).toHaveLength(16)
  })

  it('wraps indexes by the available identicon count', () => {
    const { container: first } = render(getIdenticon(0))
    const { container: wrapped } = render(getIdenticon(4))

    expect(wrapped.innerHTML).toBe(first.innerHTML)
  })
})
