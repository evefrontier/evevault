import { beforeEach, describe, expect, it, vi } from "vitest";
import { isBrowser, isExtension, isWeb } from "../environment";

describe("environment detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isBrowser", () => {
    it("returns true when window is defined", () => {
      // In jsdom environment, window is always defined
      expect(isBrowser()).toBe(true);
    });

    it("returns false when window is undefined", () => {
      const originalWindow = global.window;
      // @ts-expect-error Testing runtime behavior
      delete global.window;

      expect(isBrowser()).toBe(false);

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("isExtension", () => {
    it("returns true when chrome runtime is available", () => {
      // @ts-expect-error Mocking chrome API
      global.chrome = {
        runtime: {
          id: "test-extension-id",
        },
      };

      expect(isExtension()).toBe(true);

      // Cleanup
      // @ts-expect-error Cleanup
      delete global.chrome;
    });

    it("returns false when chrome is undefined", () => {
      // @ts-expect-error Ensure chrome is undefined
      global.chrome = undefined;
      expect(isExtension()).toBe(false);
    });

    it("returns false when chrome.runtime is undefined", () => {
      // @ts-expect-error Mocking chrome without runtime
      global.chrome = {};
      expect(isExtension()).toBe(false);

      // Cleanup
      // @ts-expect-error Cleanup
      delete global.chrome;
    });

    it("returns false when chrome.runtime.id is undefined", () => {
      // @ts-expect-error Mocking chrome without id
      global.chrome = {
        runtime: {},
      };
      expect(isExtension()).toBe(false);

      // Cleanup
      // @ts-expect-error Cleanup
      delete global.chrome;
    });
  });

  describe("isWeb", () => {
    it("returns true in browser environment without chrome extension", () => {
      // @ts-expect-error Ensure chrome is not defined
      global.chrome = undefined;
      expect(isWeb()).toBe(true);
    });

    it("returns false in chrome extension environment", () => {
      // @ts-expect-error Mocking chrome API
      global.chrome = {
        runtime: {
          id: "test-extension-id",
        },
      };

      expect(isWeb()).toBe(false);

      // Cleanup
      // @ts-expect-error Cleanup
      delete global.chrome;
    });

    it("returns false when window is undefined (SSR)", () => {
      const originalWindow = global.window;
      // @ts-expect-error Testing SSR behavior
      delete global.window;

      expect(isWeb()).toBe(false);

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("integration scenarios", () => {
    it("handles web app scenario correctly", () => {
      // @ts-expect-error Ensure chrome is not defined
      global.chrome = undefined;
      
      expect(isBrowser()).toBe(true);
      expect(isExtension()).toBe(false);
      expect(isWeb()).toBe(true);
    });

    it("handles extension scenario correctly", () => {
      // @ts-expect-error Mocking chrome API
      global.chrome = {
        runtime: {
          id: "test-extension-id",
        },
      };

      expect(isBrowser()).toBe(true);
      expect(isExtension()).toBe(true);
      expect(isWeb()).toBe(false);

      // Cleanup
      // @ts-expect-error Cleanup
      delete global.chrome;
    });
  });
});
