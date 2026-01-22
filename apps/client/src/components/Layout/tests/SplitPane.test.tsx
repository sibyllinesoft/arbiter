/**
 * @vitest-environment jsdom
 */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SplitPane from "../SplitPane";

const defaultRect: DOMRect = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  top: 0,
  left: 0,
  right: 800,
  bottom: 600,
  toJSON: () => ({}),
};

describe("SplitPane", () => {
  it("renders both panes and the resizer by default", () => {
    const { container, getByText } = render(
      <SplitPane>
        <div>Left</div>
        <div>Right</div>
      </SplitPane>,
    );

    expect(getByText("Left")).toBeInTheDocument();
    expect(getByText("Right")).toBeInTheDocument();
    expect(container.querySelector(".cursor-col-resize")).toBeTruthy();
  });

  it("hides the resizer when resizing is disabled", () => {
    const { container } = render(
      <SplitPane allowResize={false}>
        <div>Left</div>
        <div>Right</div>
      </SplitPane>,
    );

    expect(container.querySelector(".cursor-col-resize")).toBeNull();
  });

  it("updates pane size when dragged within bounds", () => {
    const { container } = render(
      <SplitPane defaultSize="40%" minSize="20%" maxSize="80%">
        <div>Left</div>
        <div>Right</div>
      </SplitPane>,
    );

    const root = container.firstElementChild as HTMLElement;
    const leftPane = root.children[0] as HTMLElement;
    const resizer = root.querySelector(".cursor-col-resize") as HTMLElement;

    const rectSpy = vi.spyOn(root, "getBoundingClientRect").mockReturnValue(defaultRect);

    fireEvent.mouseDown(resizer, { clientX: 320 });
    fireEvent.mouseMove(document, { clientX: 640 });
    fireEvent.mouseUp(document);

    expect(leftPane.style.width).toBe("80%");
    rectSpy.mockRestore();
  });
});
