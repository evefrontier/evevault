import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./useToast";

// Test component that uses the toast hook
function TestComponent({ onToastShow }: { onToastShow?: () => void }) {
  const { showToast } = useToast();

  const handleClick = () => {
    showToast("Test toast message");
    onToastShow?.();
  };

  const handleCustomDuration = () => {
    showToast("Custom duration toast", 1000);
  };

  return (
    <div>
      <button onClick={handleClick}>Show Toast</button>
      <button onClick={handleCustomDuration}>Show Custom Toast</button>
    </div>
  );
}

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("ToastProvider", () => {
    it("renders children", () => {
      render(
        <ToastProvider>
          <div>Child content</div>
        </ToastProvider>
      );

      expect(screen.getByText("Child content")).toBeVisible();
    });

    it("provides toast context to children", () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Should not throw error about missing context
      expect(screen.getByText("Show Toast")).toBeVisible();
    });
  });

  describe("showToast", () => {
    it("displays toast with message", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));

      expect(screen.getByText("Test toast message")).toBeVisible();
    });

    it("displays multiple different messages", async () => {
      const user = userEvent.setup({ delay: null });

      function MultipleToasts() {
        const { showToast } = useToast();
        return (
          <div>
            <button onClick={() => showToast("First message")}>First</button>
            <button onClick={() => showToast("Second message")}>
              Second
            </button>
          </div>
        );
      }

      render(
        <ToastProvider>
          <MultipleToasts />
        </ToastProvider>
      );

      await user.click(screen.getByText("First"));
      expect(screen.getByText("First message")).toBeVisible();

      // Wait for first toast to dismiss
      vi.advanceTimersByTime(3300);
      await waitFor(() => {
        expect(screen.queryByText("First message")).not.toBeInTheDocument();
      });

      await user.click(screen.getByText("Second"));
      expect(screen.getByText("Second message")).toBeVisible();
    });

    it("supports custom duration", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Custom Toast"));

      expect(screen.getByText("Custom duration toast")).toBeVisible();

      // Custom duration is 1000ms + 300ms animation
      vi.advanceTimersByTime(1300);

      await waitFor(() => {
        expect(
          screen.queryByText("Custom duration toast")
        ).not.toBeInTheDocument();
      });
    });

    it("auto-dismisses toast after default duration", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));
      expect(screen.getByText("Test toast message")).toBeVisible();

      // Default duration is 3000ms + 300ms animation
      vi.advanceTimersByTime(3300);

      await waitFor(() => {
        expect(screen.queryByText("Test toast message")).not.toBeInTheDocument();
      });
    });
  });

  describe("multiple toasts", () => {
    it("replaces previous toast with new one", async () => {
      const user = userEvent.setup({ delay: null });

      function RapidToasts() {
        const { showToast } = useToast();
        return (
          <button
            onClick={() => {
              showToast("First");
              setTimeout(() => showToast("Second"), 100);
            }}
          >
            Show Multiple
          </button>
        );
      }

      render(
        <ToastProvider>
          <RapidToasts />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Multiple"));

      // First toast appears
      expect(screen.getByText("First")).toBeVisible();

      // Advance to second toast
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText("Second")).toBeVisible();
      });
    });

    it("handles rapid successive toasts", async () => {
      const user = userEvent.setup({ delay: null });

      function RapidClicks() {
        const { showToast } = useToast();
        let count = 0;
        return (
          <button onClick={() => showToast(`Toast ${++count}`)}>
            Click Rapidly
          </button>
        );
      }

      render(
        <ToastProvider>
          <RapidClicks />
        </ToastProvider>
      );

      // Click multiple times rapidly
      await user.click(screen.getByText("Click Rapidly"));
      await user.click(screen.getByText("Click Rapidly"));
      await user.click(screen.getByText("Click Rapidly"));

      // Last toast should be visible
      expect(screen.getByText(/Toast \d/)).toBeVisible();
    });
  });

  describe("error handling", () => {
    it("throws error when useToast is used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function ComponentWithoutProvider() {
        // This should throw
        const { showToast } = useToast();
        return <button onClick={() => showToast("test")}>Test</button>;
      }

      expect(() => {
        render(<ComponentWithoutProvider />);
      }).toThrow("useToast must be used within a ToastProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("callback integration", () => {
    it("calls callback when toast is shown", async () => {
      const handleToastShow = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent onToastShow={handleToastShow} />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));

      expect(handleToastShow).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Test toast message")).toBeVisible();
    });
  });

  describe("toast lifecycle", () => {
    it("shows toast immediately when showToast is called", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));

      // Toast should appear immediately (no delay)
      expect(screen.getByText("Test toast message")).toBeVisible();
    });

    it("maintains toast visibility for full duration", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));

      // Check at various points during duration
      expect(screen.getByText("Test toast message")).toBeVisible();

      vi.advanceTimersByTime(1000);
      expect(screen.getByText("Test toast message")).toBeVisible();

      vi.advanceTimersByTime(1000);
      expect(screen.getByText("Test toast message")).toBeVisible();

      vi.advanceTimersByTime(1000);
      // Still visible at end of duration (before animation)
      expect(screen.getByText("Test toast message")).toBeVisible();
    });

    it("removes toast after duration + animation time", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Toast"));

      // Fast forward past duration (3000ms) and animation (300ms)
      vi.advanceTimersByTime(3300);

      await waitFor(() => {
        expect(screen.queryByText("Test toast message")).not.toBeInTheDocument();
      });
    });
  });

  describe("edge cases", () => {
    it("handles zero duration", async () => {
      const user = userEvent.setup({ delay: null });

      function ZeroDurationToast() {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast("Zero duration", 0)}>Show</button>
        );
      }

      render(
        <ToastProvider>
          <ZeroDurationToast />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show"));

      // Even with 0 duration, animation takes 300ms
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText("Zero duration")).not.toBeInTheDocument();
      });
    });

    it("handles empty message", async () => {
      const user = userEvent.setup({ delay: null });

      function EmptyMessageToast() {
        const { showToast } = useToast();
        return <button onClick={() => showToast("")}>Show Empty</button>;
      }

      render(
        <ToastProvider>
          <EmptyMessageToast />
        </ToastProvider>
      );

      await user.click(screen.getByText("Show Empty"));

      // Toast component should render even with empty message
      const { container } = render(
        <ToastProvider>
          <EmptyMessageToast />
        </ToastProvider>
      );
      
      await user.click(screen.getAllByText("Show Empty")[1]);
      // No error should be thrown
    });
  });
});
