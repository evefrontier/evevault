import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BREAKPOINTS, useResponsive } from "../useResponsive";

describe("useResponsive", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window width
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe("initial state", () => {
    it("returns mobile state for narrow screens", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.width).toBe(500);
    });

    it("returns tablet state for medium screens", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.width).toBe(900);
    });

    it("returns desktop state for wide screens", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1440,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.width).toBe(1440);
    });
  });

  describe("breakpoint boundaries", () => {
    it("handles mobile breakpoint exactly", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: BREAKPOINTS.mobile,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.width).toBe(BREAKPOINTS.mobile);
    });

    it("handles tablet breakpoint exactly", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: BREAKPOINTS.tablet,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.width).toBe(BREAKPOINTS.tablet);
    });

    it("handles width just below mobile breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: BREAKPOINTS.mobile - 1,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
    });

    it("handles width just below tablet breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: BREAKPOINTS.tablet - 1,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });
  });

  describe("resize handling", () => {
    it("updates state on window resize from mobile to tablet", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);

      // Simulate resize to tablet
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 900,
        });
        window.dispatchEvent(new Event("resize"));
      });

      // Wait for requestAnimationFrame
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
    });

    it("updates state on window resize from tablet to desktop", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(true);

      // Simulate resize to desktop
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 1440,
        });
        window.dispatchEvent(new Event("resize"));
      });

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });

    it("updates width value on resize", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.width).toBe(800);

      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 1200,
        });
        window.dispatchEvent(new Event("resize"));
      });

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.width).toBe(1200);
    });
  });

  describe("cleanup", () => {
    it("removes resize listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useResponsive());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "resize",
        expect.any(Function)
      );
    });

    it("cancels pending animation frame on unmount", () => {
      const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");

      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      });

      const { unmount } = renderHook(() => useResponsive());

      // Trigger resize without completing animation frame
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      unmount();

      // Should have cancelled the pending frame
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles very small widths", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 320,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.width).toBe(320);
    });

    it("handles very large widths", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 3840,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isDesktop).toBe(true);
      expect(result.current.width).toBe(3840);
    });
  });
});
