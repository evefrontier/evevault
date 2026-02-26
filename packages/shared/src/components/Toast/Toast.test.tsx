import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("visibility", () => {
    it("renders when isVisible is true", () => {
      render(
        <Toast message="Test message" isVisible onClose={vi.fn()} />
      );
      expect(screen.getByText("Test message")).toBeVisible();
    });

    it("does not render when isVisible is false", () => {
      render(
        <Toast message="Test message" isVisible={false} onClose={vi.fn()} />
      );
      expect(screen.queryByText("Test message")).not.toBeInTheDocument();
    });

    it("displays provided message", () => {
      render(
        <Toast message="Custom message" isVisible onClose={vi.fn()} />
      );
      expect(screen.getByText("Custom message")).toBeVisible();
    });

    it("displays different messages", () => {
      const { rerender } = render(
        <Toast message="First message" isVisible onClose={vi.fn()} />
      );
      expect(screen.getByText("First message")).toBeVisible();

      rerender(
        <Toast message="Second message" isVisible onClose={vi.fn()} />
      );
      expect(screen.getByText("Second message")).toBeVisible();
    });
  });

  describe("auto-dismiss", () => {
    it("calls onClose after default duration", async () => {
      const handleClose = vi.fn();
      render(
        <Toast message="Auto dismiss" isVisible onClose={handleClose} />
      );

      // Fast forward default duration (3000ms) + animation (300ms)
      vi.advanceTimersByTime(3300);

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it("calls onClose after custom duration", async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          message="Custom duration"
          isVisible
          onClose={handleClose}
          duration={1000}
        />
      );

      // Fast forward custom duration (1000ms) + animation (300ms)
      vi.advanceTimersByTime(1300);

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it("does not call onClose before duration expires", async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          message="Wait for it"
          isVisible
          onClose={handleClose}
          duration={3000}
        />
      );

      // Fast forward less than duration
      vi.advanceTimersByTime(1000);

      expect(handleClose).not.toHaveBeenCalled();
    });

    it("clears timer on unmount", () => {
      const handleClose = vi.fn();
      const { unmount } = render(
        <Toast message="Unmounting" isVisible onClose={handleClose} />
      );

      unmount();

      // Fast forward time after unmount
      vi.advanceTimersByTime(5000);

      // Should not call onClose after unmount
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("animations", () => {
    it("applies visible animation classes", () => {
      const { container } = render(
        <Toast message="Animating" isVisible onClose={vi.fn()} />
      );

      const toast = container.querySelector(".opacity-100");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveClass("translate-y-0");
    });

    it("transitions to hidden animation before closing", async () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Toast
          message="Hiding"
          isVisible
          onClose={handleClose}
          duration={1000}
        />
      );

      // Initial visible state
      expect(container.querySelector(".opacity-100")).toBeInTheDocument();

      // Fast forward past duration but before animation complete
      vi.advanceTimersByTime(1050);

      await waitFor(() => {
        expect(container.querySelector(".opacity-0")).toBeInTheDocument();
      });
    });

    it("remains visible during animation", async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          message="Still visible"
          isVisible
          onClose={handleClose}
          duration={1000}
        />
      );

      // Fast forward to start of hide animation
      vi.advanceTimersByTime(1000);

      // Toast should still be in DOM during animation
      expect(screen.getByText("Still visible")).toBeInTheDocument();
    });
  });

  describe("positioning", () => {
    it("has fixed position at top center", () => {
      const { container } = render(
        <Toast message="Positioned" isVisible onClose={vi.fn()} />
      );

      const toast = container.firstChild as HTMLElement;
      expect(toast).toHaveClass("fixed");
      expect(toast).toHaveClass("top-6");
      expect(toast).toHaveClass("left-1/2");
      expect(toast).toHaveClass("-translate-x-1/2");
    });

    it("has high z-index for visibility", () => {
      const { container } = render(
        <Toast message="On top" isVisible onClose={vi.fn()} />
      );

      const toast = container.firstChild as HTMLElement;
      expect(toast).toHaveClass("z-[9999]");
    });
  });

  describe("edge cases", () => {
    it("handles very long messages", () => {
      const longMessage = "A".repeat(200);
      render(
        <Toast message={longMessage} isVisible onClose={vi.fn()} />
      );

      expect(screen.getByText(longMessage)).toBeVisible();
    });

    it("handles empty message", () => {
      render(
        <Toast message="" isVisible onClose={vi.fn()} />
      );

      // Toast should render but with empty content
      const { container } = render(
        <Toast message="" isVisible onClose={vi.fn()} />
      );
      expect(container.querySelector(".fixed")).toBeInTheDocument();
    });

    it("handles very short duration", async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          message="Quick"
          isVisible
          onClose={handleClose}
          duration={100}
        />
      );

      vi.advanceTimersByTime(400); // 100ms duration + 300ms animation

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it("handles very long duration", async () => {
      const handleClose = vi.fn();
      render(
        <Toast
          message="Slow"
          isVisible
          onClose={handleClose}
          duration={10000}
        />
      );

      // Should not close before duration
      vi.advanceTimersByTime(5000);
      expect(handleClose).not.toHaveBeenCalled();

      // Should close after duration + animation
      vi.advanceTimersByTime(5300);
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe("state changes", () => {
    it("resets timer when isVisible changes from false to true", async () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Toast message="Test" isVisible={false} onClose={handleClose} />
      );

      // Make visible
      rerender(
        <Toast message="Test" isVisible onClose={handleClose} duration={1000} />
      );

      // Fast forward
      vi.advanceTimersByTime(1300);

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it("cancels timer when isVisible changes to false", () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Toast message="Test" isVisible onClose={handleClose} duration={1000} />
      );

      // Hide before timer expires
      vi.advanceTimersByTime(500);
      rerender(
        <Toast message="Test" isVisible={false} onClose={handleClose} />
      );

      // Fast forward past original duration
      vi.advanceTimersByTime(1000);

      // Should not have called onClose
      expect(handleClose).not.toHaveBeenCalled();
    });
  });
});
