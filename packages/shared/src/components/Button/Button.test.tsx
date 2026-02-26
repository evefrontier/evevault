import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders with provided label", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeVisible();
    });

    it("renders children content", () => {
      render(
        <Button>
          <span data-testid="custom-content">Custom Content</span>
        </Button>
      );
      expect(screen.getByTestId("custom-content")).toBeVisible();
    });
  });

  describe("variants", () => {
    it("applies primary variant class by default", () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--primary");
    });

    it("applies secondary variant class", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--secondary");
    });

    it("applies tertiary variant class", () => {
      render(<Button variant="tertiary">Tertiary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button--tertiary");
    });

    it("shows decorations for primary variant", () => {
      const { container } = render(<Button variant="primary">Primary</Button>);
      expect(container.querySelector(".button__edge-left")).toBeInTheDocument();
      expect(container.querySelector(".button__edge-right")).toBeInTheDocument();
    });

    it("shows decorations for secondary variant", () => {
      const { container } = render(
        <Button variant="secondary">Secondary</Button>
      );
      expect(container.querySelector(".button__edge-left")).toBeInTheDocument();
      expect(container.querySelector(".button__edge-right")).toBeInTheDocument();
    });

    it("hides decorations for tertiary variant", () => {
      const { container } = render(
        <Button variant="tertiary">Tertiary</Button>
      );
      expect(
        container.querySelector(".button__edge-left")
      ).not.toBeInTheDocument();
      expect(
        container.querySelector(".button__edge-right")
      ).not.toBeInTheDocument();
    });
  });

  describe("sizes", () => {
    it("applies medium size by default", () => {
      render(<Button>Medium</Button>);
      expect(screen.getByRole("button")).toHaveClass("button--medium");
    });

    it("applies small size", () => {
      render(<Button size="small">Small</Button>);
      expect(screen.getByRole("button")).toHaveClass("button--small");
    });

    it("applies large size", () => {
      render(<Button size="large">Large</Button>);
      expect(screen.getByRole("button")).toHaveClass("button--large");
    });
  });

  describe("disabled state", () => {
    it("is enabled by default", () => {
      render(<Button>Enabled</Button>);
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("can be disabled", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("applies disabled class when disabled", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toHaveClass("button--disabled");
    });

    it("does not trigger onClick when disabled", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );

      await user.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("interactions", () => {
    it("triggers onClick when clicked", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Click me</Button>);

      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("supports type attribute", () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("defaults to button type", () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      render(<Button className="custom-class">Custom</Button>);
      expect(screen.getByRole("button")).toHaveClass("custom-class");
    });

    it("preserves base classes with custom className", () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("accessibility", () => {
    it("has button role", () => {
      render(<Button>Accessible</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("supports aria-label", () => {
      render(<Button aria-label="Custom label">Icon</Button>);
      expect(screen.getByLabelText("Custom label")).toBeInTheDocument();
    });

    it("can be focused", () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole("button");
      button.focus();
      expect(button).toHaveFocus();
    });
  });
});
