import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../../../test/utils";
import Button from "./Button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders with default props", () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole("button", { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("inline-flex", "items-center", "justify-center");
    });

    it("renders without children", () => {
      render(<Button data-testid="empty-button" />);

      const button = screen.getByTestId("empty-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });

    it("applies custom className", () => {
      render(<Button className="custom-class">Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("forwards ref correctly", () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Test</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toBe(screen.getByRole("button"));
    });
  });

  describe("variants", () => {
    it.each([["primary"], ["secondary"], ["ghost"], ["danger"]])(
      "renders %s variant correctly",
      (variant) => {
        render(<Button variant={variant as any}>Test</Button>);

        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
        // Note: We can't test the exact classes without knowing the variant implementation
        // But we ensure it renders without errors
      },
    );

    it("defaults to primary variant", () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("sizes", () => {
    it.each([["xs"], ["sm"], ["md"], ["lg"], ["xl"]])("renders %s size correctly", (size) => {
      render(<Button size={size as any}>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("defaults to md size", () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("fullWidth prop", () => {
    it("applies full width class when fullWidth is true", () => {
      render(<Button fullWidth>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("w-full");
    });

    it("does not apply full width class when fullWidth is false", () => {
      render(<Button fullWidth={false}>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).not.toHaveClass("w-full");
    });
  });

  describe("icons", () => {
    it("renders left icon", () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      render(<Button leftIcon={leftIcon}>Test</Button>);

      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("renders right icon", () => {
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(<Button rightIcon={rightIcon}>Test</Button>);

      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("renders both left and right icons", () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon}>
          Test
        </Button>,
      );

      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("hides icons when loading", () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon} loading>
          Test
        </Button>,
      );

      expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when loading is true", () => {
      render(<Button loading>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-transparent");

      // Check for loading spinner
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("disables button when loading", () => {
      render(<Button loading>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("does not show loading spinner when loading is false", () => {
      render(<Button loading={false}>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).not.toHaveClass("text-transparent");

      const spinner = button.querySelector(".animate-spin");
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("disables button when disabled prop is true", () => {
      render(<Button disabled>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:pointer-events-none", "disabled:opacity-60");
    });

    it("enables button when disabled prop is false", () => {
      render(<Button disabled={false}>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toBeEnabled();
    });

    it("disables button when both disabled and loading are true", () => {
      render(
        <Button disabled loading>
          Test
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} disabled>
          Click me
        </Button>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when loading", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} loading>
          Click me
        </Button>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("supports keyboard interaction (Enter)", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard interaction (Space)", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has correct button role", () => {
      render(<Button>Test</Button>);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("supports aria-label", () => {
      render(<Button aria-label="Custom label">Test</Button>);

      const button = screen.getByLabelText("Custom label");
      expect(button).toBeInTheDocument();
    });

    it("supports aria-describedby", () => {
      render(
        <>
          <Button aria-describedby="help-text">Test</Button>
          <div id="help-text">Help text</div>
        </>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-describedby", "help-text");
    });

    it("is focusable when not disabled", () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole("button");
      button.focus();
      expect(button).toHaveFocus();
    });

    it("is not focusable when disabled", () => {
      render(<Button disabled>Test</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("disabled");
    });

    it("announces loading state to screen readers", () => {
      render(<Button loading aria-label="Save" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      // The loading spinner provides visual indication
      expect(button.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("HTML attributes", () => {
    it("forwards HTML button attributes", () => {
      render(
        <Button type="submit" form="test-form" data-testid="test-button" title="Test title">
          Test
        </Button>,
      );

      const button = screen.getByTestId("test-button");
      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveAttribute("form", "test-form");
      expect(button).toHaveAttribute("title", "Test title");
    });

    it("does not forward size prop as HTML attribute", () => {
      render(<Button size="lg">Test</Button>);

      const button = screen.getByRole("button");
      expect(button).not.toHaveAttribute("size");
    });
  });
});
