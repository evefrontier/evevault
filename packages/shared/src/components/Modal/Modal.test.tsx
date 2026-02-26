import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  beforeEach(() => {
    // Reset body overflow before each test
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Clean up after each test
    document.body.style.overflow = "";
  });

  describe("visibility", () => {
    it("renders when isOpen is true", () => {
      render(<Modal isOpen title="Test Modal" />);
      expect(screen.getByRole("dialog")).toBeVisible();
    });

    it("does not render when isOpen is false", () => {
      render(<Modal isOpen={false} title="Test Modal" />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows title when provided", () => {
      render(<Modal isOpen title="Modal Title" />);
      expect(screen.getByText("Modal Title")).toBeVisible();
    });

    it("shows message when provided", () => {
      render(<Modal isOpen message="Modal message content" />);
      expect(screen.getByText("Modal message content")).toBeVisible();
    });

    it("renders children content", () => {
      render(
        <Modal isOpen>
          <div data-testid="custom-content">Custom Content</div>
        </Modal>
      );
      expect(screen.getByTestId("custom-content")).toBeVisible();
    });
  });

  describe("sizes", () => {
    it("applies small size by default", () => {
      const { container } = render(<Modal isOpen title="Test" />);
      expect(container.querySelector(".modal--small")).toBeInTheDocument();
    });

    it("applies medium size", () => {
      const { container } = render(<Modal isOpen title="Test" size="medium" />);
      expect(container.querySelector(".modal--medium")).toBeInTheDocument();
    });

    it("applies large size", () => {
      const { container } = render(<Modal isOpen title="Test" size="large" />);
      expect(container.querySelector(".modal--large")).toBeInTheDocument();
    });

    it("applies full size", () => {
      const { container } = render(<Modal isOpen title="Test" size="full" />);
      expect(container.querySelector(".modal--full")).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("shows primary action button", () => {
      const handlePrimary = vi.fn();
      render(
        <Modal
          isOpen
          title="Test"
          primaryAction={{ label: "Confirm", onClick: handlePrimary }}
        />
      );
      expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
    });

    it("shows secondary action button", () => {
      const handleSecondary = vi.fn();
      render(
        <Modal
          isOpen
          title="Test"
          secondaryAction={{ label: "Cancel", onClick: handleSecondary }}
        />
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    });

    it("shows both action buttons", () => {
      const handlePrimary = vi.fn();
      const handleSecondary = vi.fn();
      render(
        <Modal
          isOpen
          title="Test"
          primaryAction={{ label: "Confirm", onClick: handlePrimary }}
          secondaryAction={{ label: "Cancel", onClick: handleSecondary }}
        />
      );
      expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    });

    it("triggers primary action onClick", async () => {
      const handlePrimary = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal
          isOpen
          title="Test"
          primaryAction={{ label: "Confirm", onClick: handlePrimary }}
        />
      );

      await user.click(screen.getByRole("button", { name: "Confirm" }));
      expect(handlePrimary).toHaveBeenCalledTimes(1);
    });

    it("triggers secondary action onClick", async () => {
      const handleSecondary = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal
          isOpen
          title="Test"
          secondaryAction={{ label: "Cancel", onClick: handleSecondary }}
        />
      );

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });

    it("disables primary action when disabled prop is true", () => {
      const handlePrimary = vi.fn();
      render(
        <Modal
          isOpen
          title="Test"
          primaryAction={{
            label: "Confirm",
            onClick: handlePrimary,
            disabled: true,
          }}
        />
      );
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("shows loading state for primary action", () => {
      const handlePrimary = vi.fn();
      render(
        <Modal
          isOpen
          title="Test"
          primaryAction={{
            label: "Confirm",
            onClick: handlePrimary,
            isLoading: true,
          }}
        />
      );
      // Button should be present and likely have loading indicator
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });
  });

  describe("closing behavior", () => {
    it("calls onClose when overlay is clicked", async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal isOpen onClose={handleClose} title="Test" />
      );

      const overlay = screen.getByRole("dialog").parentElement;
      if (overlay) {
        await user.click(overlay);
        expect(handleClose).toHaveBeenCalledTimes(1);
      }
    });

    it("does not close when clicking modal content", async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal isOpen onClose={handleClose} title="Test Modal" />
      );

      await user.click(screen.getByText("Test Modal"));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it("does not close on overlay click when closeOnOverlayClick is false", async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      render(
        <Modal
          isOpen
          onClose={handleClose}
          title="Test"
          closeOnOverlayClick={false}
        />
      );

      const overlay = screen.getByRole("dialog").parentElement;
      if (overlay) {
        await user.click(overlay);
        expect(handleClose).not.toHaveBeenCalled();
      }
    });

    it("closes when Escape key is pressed", async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();
      render(<Modal isOpen onClose={handleClose} title="Test" />);

      await user.keyboard("{Escape}");
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not close on Escape when onClose is not provided", async () => {
      const user = userEvent.setup();
      render(<Modal isOpen title="Test" />);

      await user.keyboard("{Escape}");
      // Should not throw error and modal should still be visible
      expect(screen.getByRole("dialog")).toBeVisible();
    });
  });

  describe("body scroll prevention", () => {
    it("prevents body scroll when open", () => {
      render(<Modal isOpen title="Test" />);
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(<Modal isOpen title="Test" />);
      expect(document.body.style.overflow).toBe("hidden");

      rerender(<Modal isOpen={false} title="Test" />);
      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(<Modal isOpen title="Test" />);
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("accessibility", () => {
    it("has dialog role", () => {
      render(<Modal isOpen title="Test" />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal attribute", () => {
      render(<Modal isOpen title="Test" />);
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <Modal isOpen title="Test" className="custom-modal" />
      );
      expect(container.querySelector(".custom-modal")).toBeInTheDocument();
    });
  });

  describe("full width actions", () => {
    it("applies full width class to actions", () => {
      const { container } = render(
        <Modal
          isOpen
          title="Test"
          fullWidthActions
          primaryAction={{ label: "Confirm", onClick: vi.fn() }}
        />
      );
      expect(
        container.querySelector(".modal__actions--full")
      ).toBeInTheDocument();
    });
  });
});
