import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trySettle } from "../timeoutGuard";

describe("trySettle", () => {
  let state: { settled: boolean };
  let listener: (e: MessageEvent) => void;
  let target: EventTarget;

  beforeEach(() => {
    state = { settled: false };
    listener = vi.fn();
    target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as EventTarget;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns true on first call and sets state.settled to true", () => {
    expect(trySettle(state, listener, undefined, target)).toBe(true);
    expect(state.settled).toBe(true);
  });

  it("removes the message listener from the target on first call", () => {
    trySettle(state, listener, undefined, target);
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
    expect(target.removeEventListener).toHaveBeenCalledWith(
      "message",
      listener,
    );
  });

  it("returns false on second call when already settled", () => {
    trySettle(state, listener, undefined, target);
    expect(trySettle(state, listener, undefined, target)).toBe(false);
  });

  it("does not call removeEventListener again on second call", () => {
    trySettle(state, listener, undefined, target);
    trySettle(state, listener, undefined, target);
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("calls clearTimeout when timeoutId is provided", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const timeoutId = setTimeout(() => {}, 1000);
    try {
      trySettle(state, listener, timeoutId, target);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it("does not call clearTimeout when timeoutId is undefined", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    try {
      trySettle(state, listener, undefined, target);
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it("uses window as target when target is not provided", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    try {
      trySettle(state, listener);
      expect(removeSpy).toHaveBeenCalledWith("message", listener);
    } finally {
      removeSpy.mockRestore();
    }
  });
});
