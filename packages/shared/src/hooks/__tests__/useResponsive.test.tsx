import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResponsive } from '#/hooks/useResponsive';

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('useResponsive', () => {
  let rafCallbacks: FrameRequestCallback[];
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>;
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = [];
    requestAnimationFrameSpy = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    cancelAnimationFrameSpy = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy);
    setInnerWidth(1200);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initial state defaults to desktop on SSR', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    let snapshot: ReturnType<typeof useResponsive> | undefined;

    function Probe() {
      snapshot = useResponsive();
      return null;
    }

    renderToString(<Probe />);

    expect(snapshot).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1200,
    });
    vi.stubGlobal('window', originalWindow);
  });

  it('initial state reads window.innerWidth on first render', () => {
    setInnerWidth(900);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.width).toBe(900);
    expect(result.current.isTablet).toBe(true);
  });

  it.each([
    [767, 'isMobile'],
    [768, 'isTablet'],
    [1024, 'isDesktop'],
  ] as const)('sets %s breakpoint state', (width, expectedFlag) => {
    setInnerWidth(width);

    const { result } = renderHook(() => useResponsive());

    expect(result.current[expectedFlag]).toBe(true);
  });

  it('updates state on resize after RAF fires', () => {
    const { result } = renderHook(() => useResponsive());

    act(() => {
      setInnerWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isDesktop).toBe(true);

    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(performance.now());
    });

    expect(result.current.width).toBe(500);
    expect(result.current.isMobile).toBe(true);
  });

  it('rapid resize events result in one committed state update for the latest frame', () => {
    const { result } = renderHook(() => useResponsive());

    act(() => {
      setInnerWidth(900);
      window.dispatchEvent(new Event('resize'));
      setInnerWidth(500);
      window.dispatchEvent(new Event('resize'));
      setInnerWidth(1100);
      window.dispatchEvent(new Event('resize'));
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(3);
    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(2);
    expect(result.current.width).toBe(1200);

    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(performance.now());
    });

    expect(result.current.width).toBe(1100);
    expect(result.current.isDesktop).toBe(true);
  });

  it('falls back to desktop when window.innerWidth is undefined', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.width).toBe(1200);
    // Restore for subsequent tests
    setInnerWidth(1200);
  });

  it('cancels pending RAF on unmount', () => {
    const { unmount } = renderHook(() => useResponsive());

    act(() => {
      setInnerWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
  });
});
