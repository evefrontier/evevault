import { describe, expect, it } from 'vitest'
import {
  calculateResponsivePadding,
  type PaddingConfig,
} from '#/utils/calculate'

const config: PaddingConfig = {
  desktop: { top: 100, sides: 40 },
  mobile: { minTop: 20, minHorizontal: 10, topVh: 5, horizontalVh: 2 },
}

const breakpoints = { mobile: 768, tablet: 1024 } as const

describe('calculateResponsivePadding', () => {
  it('returns fixed desktop padding at and above the tablet breakpoint', () => {
    expect(calculateResponsivePadding(1024, 800, config, breakpoints)).toEqual({
      paddingTop: 100,
      paddingLeft: 40,
      paddingRight: 40,
      paddingBottom: 0,
    })
    expect(
      calculateResponsivePadding(1600, 800, config, breakpoints).paddingTop,
    ).toBe(100)
  })

  it('uses pure mobile values at the mobile breakpoint (interpolation factor 0)', () => {
    // factor = (768 - 768) / (1024 - 768) = 0 → all weight on mobile-from-height
    // mobileTop = max(20, 800 * 5 / 100) = max(20, 40) = 40
    // mobileHorizontal = max(10, 800 * 2 / 100) = max(10, 16) = 16
    const result = calculateResponsivePadding(768, 800, config, breakpoints)
    expect(result.paddingTop).toBeCloseTo(40)
    expect(result.paddingLeft).toBeCloseTo(16)
    expect(result.paddingRight).toBeCloseTo(16)
    expect(result.paddingBottom).toBe(0)
  })

  it('clamps the interpolation factor to 0 below the mobile breakpoint', () => {
    // width 400 < mobile → raw factor negative → clamped to 0 → same as mobile breakpoint
    const below = calculateResponsivePadding(400, 800, config, breakpoints)
    const atMobile = calculateResponsivePadding(768, 800, config, breakpoints)
    expect(below).toEqual(atMobile)
  })

  it('interpolates between desktop and mobile in the mid-range', () => {
    // width 896 → factor = (896 - 768) / 256 = 0.5
    // mobileTop = max(20, 800*5/100)=40; paddingTop = 100*0.5 + 40*0.5 = 70
    // mobileHorizontal = max(10, 800*2/100)=16; horizontal = 40*0.5 + 16*0.5 = 28
    const result = calculateResponsivePadding(896, 800, config, breakpoints)
    expect(result.paddingTop).toBeCloseTo(70)
    expect(result.paddingLeft).toBeCloseTo(28)
  })

  it('uses the minimum padding floors when viewport-derived values are smaller', () => {
    // Tiny viewport height → height-derived values fall below the min floors.
    // mobileTop = max(20, 100*5/100=5) = 20; mobileHorizontal = max(10, 100*2/100=2) = 10
    const result = calculateResponsivePadding(768, 100, config, breakpoints)
    expect(result.paddingTop).toBeCloseTo(20)
    expect(result.paddingLeft).toBeCloseTo(10)
  })

  it('defaults to the exported BREAKPOINTS when none are provided', () => {
    // 1024 is the default tablet breakpoint → desktop path.
    expect(calculateResponsivePadding(1024, 800, config).paddingTop).toBe(100)
  })
})
