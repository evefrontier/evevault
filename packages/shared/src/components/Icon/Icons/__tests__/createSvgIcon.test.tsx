import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSvgIcon } from '../createSvgIcon'

describe('createSvgIcon', () => {
  it('renders clip path wrappers when a clipPathId is provided', () => {
    const Icon = createSvgIcon({
      ariaLabel: 'Clipped',
      clipPathId: 'clip-test',
      paths: [{ d: 'M1 1H2V2H1Z' }],
    })

    const { container } = render(<Icon />)

    expect(container.querySelector('g')).toHaveAttribute(
      'clip-path',
      'url(#clip-test)',
    )
    expect(container.querySelector('defs clipPath')).toHaveAttribute(
      'id',
      'clip-test',
    )
  })
})
