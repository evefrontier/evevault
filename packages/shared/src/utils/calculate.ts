import { BREAKPOINTS } from "../hooks/useResponsive";

export interface PaddingConfig {
  /** Desktop padding values */
  desktop: {
    top: number;
    sides: number;
  };
  /** Mobile padding configuration */
  mobile: {
    /** Minimum top padding in pixels */
    minTop: number;
    /** Minimum horizontal padding in pixels */
    minHorizontal: number;
    /** Top padding as percentage of viewport height */
    topVh: number;
    /** Horizontal padding as percentage of viewport height */
    horizontalVh: number;
  };
}

export interface PaddingStyle {
  paddingTop: number;
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
}

/**
 * Calculates responsive padding that smoothly transitions from desktop to mobile values.
 * Starts from desktop padding at the tablet breakpoint and scales down based on viewport width.
 * On mobile, also factors in viewport height for additional scaling.
 *
 * @param width - Current viewport width in pixels
 * @param viewportHeight - Current viewport height in pixels
 * @param config - Padding configuration with desktop and mobile values
 * @param breakpoints - Optional breakpoints (defaults to BREAKPOINTS from hooks)
 * @returns Padding style object with top, left, right, and bottom values
 */
export function calculateResponsivePadding(
  width: number,
  viewportHeight: number,
  config: PaddingConfig,
  breakpoints = BREAKPOINTS,
): PaddingStyle {
  // Desktop: use fixed desktop padding
  if (width >= breakpoints.tablet) {
    return {
      paddingTop: config.desktop.top,
      paddingLeft: config.desktop.sides,
      paddingRight: config.desktop.sides,
      paddingBottom: 0,
    };
  }

  // Calculate interpolation factor (0 at mobile breakpoint, 1 at desktop breakpoint)
  // This creates a smooth transition from desktop to mobile
  const interpolationFactor = Math.max(
    0,
    Math.min(
      1,
      (width - breakpoints.mobile) / (breakpoints.tablet - breakpoints.mobile),
    ),
  );

  // Base mobile padding from viewport height
  const mobileTopFromHeight = Math.max(
    config.mobile.minTop,
    (viewportHeight * config.mobile.topVh) / 100,
  );
  const mobileHorizontalFromHeight = Math.max(
    config.mobile.minHorizontal,
    (viewportHeight * config.mobile.horizontalVh) / 100,
  );

  // Interpolate between desktop and mobile values
  const paddingTop =
    config.desktop.top * interpolationFactor +
    mobileTopFromHeight * (1 - interpolationFactor);
  const paddingHorizontal =
    config.desktop.sides * interpolationFactor +
    mobileHorizontalFromHeight * (1 - interpolationFactor);

  return {
    paddingTop,
    paddingLeft: paddingHorizontal,
    paddingRight: paddingHorizontal,
    paddingBottom: 0,
  };
}
