import { describe, expect, it } from "vitest";
import {
  type PaddingConfig,
  calculateResponsivePadding,
} from "../calculate";

describe("calculateResponsivePadding", () => {
  const mockConfig: PaddingConfig = {
    desktop: {
      top: 100,
      sides: 80,
    },
    mobile: {
      minTop: 20,
      minHorizontal: 16,
      topVh: 5,
      horizontalVh: 4,
    },
  };

  const defaultBreakpoints = {
    mobile: 640,
    tablet: 1024,
  };

  describe("desktop padding", () => {
    it("returns desktop padding at tablet breakpoint", () => {
      const result = calculateResponsivePadding(
        1024,
        800,
        mockConfig,
        defaultBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 100,
        paddingLeft: 80,
        paddingRight: 80,
        paddingBottom: 0,
      });
    });

    it("returns desktop padding above tablet breakpoint", () => {
      const result = calculateResponsivePadding(
        1440,
        900,
        mockConfig,
        defaultBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 100,
        paddingLeft: 80,
        paddingRight: 80,
        paddingBottom: 0,
      });
    });

    it("returns desktop padding at very large screens", () => {
      const result = calculateResponsivePadding(
        3840,
        2160,
        mockConfig,
        defaultBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 100,
        paddingLeft: 80,
        paddingRight: 80,
        paddingBottom: 0,
      });
    });
  });

  describe("mobile padding", () => {
    it("returns mobile padding at mobile breakpoint", () => {
      const viewportHeight = 800;
      const result = calculateResponsivePadding(
        640,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );

      // At mobile breakpoint: interpolationFactor = 0, so 100% mobile padding
      const expectedTop = Math.max(
        mockConfig.mobile.minTop,
        (viewportHeight * mockConfig.mobile.topVh) / 100,
      );
      const expectedHorizontal = Math.max(
        mockConfig.mobile.minHorizontal,
        (viewportHeight * mockConfig.mobile.horizontalVh) / 100,
      );

      expect(result.paddingTop).toBeCloseTo(expectedTop, 5);
      expect(result.paddingLeft).toBeCloseTo(expectedHorizontal, 5);
      expect(result.paddingRight).toBeCloseTo(expectedHorizontal, 5);
      expect(result.paddingBottom).toBe(0);
    });

    it("uses minimum values when viewport height calculation is too small", () => {
      const viewportHeight = 100; // Very small height
      const result = calculateResponsivePadding(
        640,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );

      // With height of 100, vh calculations would be smaller than minimums
      expect(result.paddingTop).toBeGreaterThanOrEqual(mockConfig.mobile.minTop);
      expect(result.paddingLeft).toBeGreaterThanOrEqual(
        mockConfig.mobile.minHorizontal,
      );
      expect(result.paddingRight).toBeGreaterThanOrEqual(
        mockConfig.mobile.minHorizontal,
      );
    });

    it("uses viewport height calculation when larger than minimum", () => {
      const viewportHeight = 1000; // Large height
      const result = calculateResponsivePadding(
        640,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );

      const expectedTop = (viewportHeight * mockConfig.mobile.topVh) / 100; // 50px
      const expectedHorizontal =
        (viewportHeight * mockConfig.mobile.horizontalVh) / 100; // 40px

      expect(result.paddingTop).toBeCloseTo(expectedTop, 5);
      expect(result.paddingLeft).toBeCloseTo(expectedHorizontal, 5);
      expect(result.paddingRight).toBeCloseTo(expectedHorizontal, 5);
    });
  });

  describe("interpolation between desktop and mobile", () => {
    it("calculates correct interpolation at midpoint", () => {
      const midpoint = (defaultBreakpoints.mobile + defaultBreakpoints.tablet) / 2; // 832
      const viewportHeight = 800;
      const result = calculateResponsivePadding(
        midpoint,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );

      // At midpoint, interpolationFactor should be 0.5
      const mobileTop = Math.max(
        mockConfig.mobile.minTop,
        (viewportHeight * mockConfig.mobile.topVh) / 100,
      );
      const mobileHorizontal = Math.max(
        mockConfig.mobile.minHorizontal,
        (viewportHeight * mockConfig.mobile.horizontalVh) / 100,
      );

      const expectedTop =
        mockConfig.desktop.top * 0.5 + mobileTop * 0.5;
      const expectedHorizontal =
        mockConfig.desktop.sides * 0.5 + mobileHorizontal * 0.5;

      expect(result.paddingTop).toBeCloseTo(expectedTop, 5);
      expect(result.paddingLeft).toBeCloseTo(expectedHorizontal, 5);
      expect(result.paddingRight).toBeCloseTo(expectedHorizontal, 5);
    });

    it("smoothly transitions from mobile to tablet", () => {
      const viewportHeight = 800;
      const width1 = 640; // Mobile
      const width2 = 832; // Midpoint
      const width3 = 1024; // Tablet

      const result1 = calculateResponsivePadding(
        width1,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );
      const result2 = calculateResponsivePadding(
        width2,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );
      const result3 = calculateResponsivePadding(
        width3,
        viewportHeight,
        mockConfig,
        defaultBreakpoints,
      );

      // Padding should increase as width increases
      expect(result1.paddingTop).toBeLessThan(result2.paddingTop);
      expect(result2.paddingTop).toBeLessThan(result3.paddingTop);
      expect(result1.paddingLeft).toBeLessThan(result2.paddingLeft);
      expect(result2.paddingLeft).toBeLessThan(result3.paddingLeft);
    });
  });

  describe("edge cases", () => {
    it("handles width below mobile breakpoint", () => {
      const result = calculateResponsivePadding(
        320,
        800,
        mockConfig,
        defaultBreakpoints,
      );

      // Should clamp to mobile padding (interpolationFactor = 0)
      const expectedTop = Math.max(
        mockConfig.mobile.minTop,
        (800 * mockConfig.mobile.topVh) / 100,
      );
      const expectedHorizontal = Math.max(
        mockConfig.mobile.minHorizontal,
        (800 * mockConfig.mobile.horizontalVh) / 100,
      );

      expect(result.paddingTop).toBeCloseTo(expectedTop, 5);
      expect(result.paddingLeft).toBeCloseTo(expectedHorizontal, 5);
    });

    it("handles zero viewport height", () => {
      const result = calculateResponsivePadding(
        640,
        0,
        mockConfig,
        defaultBreakpoints,
      );

      // Should use minimum values
      expect(result.paddingTop).toBe(mockConfig.mobile.minTop);
      expect(result.paddingLeft).toBe(mockConfig.mobile.minHorizontal);
      expect(result.paddingRight).toBe(mockConfig.mobile.minHorizontal);
    });

    it("handles custom breakpoints", () => {
      const customBreakpoints = {
        mobile: 480,
        tablet: 768,
      };

      const result = calculateResponsivePadding(
        768,
        800,
        mockConfig,
        customBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 100,
        paddingLeft: 80,
        paddingRight: 80,
        paddingBottom: 0,
      });
    });
  });

  describe("different configurations", () => {
    it("handles configuration with larger desktop values", () => {
      const largeConfig: PaddingConfig = {
        desktop: {
          top: 200,
          sides: 150,
        },
        mobile: {
          minTop: 30,
          minHorizontal: 20,
          topVh: 8,
          horizontalVh: 6,
        },
      };

      const result = calculateResponsivePadding(
        1440,
        900,
        largeConfig,
        defaultBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 200,
        paddingLeft: 150,
        paddingRight: 150,
        paddingBottom: 0,
      });
    });

    it("handles configuration with zero desktop values", () => {
      const zeroConfig: PaddingConfig = {
        desktop: {
          top: 0,
          sides: 0,
        },
        mobile: {
          minTop: 20,
          minHorizontal: 16,
          topVh: 5,
          horizontalVh: 4,
        },
      };

      const result = calculateResponsivePadding(
        1440,
        900,
        zeroConfig,
        defaultBreakpoints,
      );

      expect(result).toEqual({
        paddingTop: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: 0,
      });
    });
  });

  describe("paddingBottom behavior", () => {
    it("always returns paddingBottom of 0", () => {
      const desktopResult = calculateResponsivePadding(
        1440,
        900,
        mockConfig,
        defaultBreakpoints,
      );
      const mobileResult = calculateResponsivePadding(
        640,
        800,
        mockConfig,
        defaultBreakpoints,
      );

      expect(desktopResult.paddingBottom).toBe(0);
      expect(mobileResult.paddingBottom).toBe(0);
    });
  });
});
