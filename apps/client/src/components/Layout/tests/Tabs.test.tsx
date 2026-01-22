/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TabItem } from "../../../types/ui";
import Tabs from "../Tabs";

vi.mock("@/components/Badge", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

const baseTabs: TabItem[] = [
  { id: "overview", label: "Overview", content: <div data-testid="overview">Overview</div> },
  { id: "details", label: "Details", content: <div data-testid="details">Details</div> },
  {
    id: "metrics",
    label: "Metrics",
    content: <div data-testid="metrics">Metrics</div>,
    badge: "3",
  },
];

describe("Tabs", () => {
  const user = userEvent.setup();

  it("renders active tab content", () => {
    render(<Tabs activeTab="details" onTabChange={vi.fn()} tabs={baseTabs} />);

    expect(screen.getByTestId("details")).toBeInTheDocument();
    expect(screen.queryByTestId("overview")).not.toBeInTheDocument();
  });

  it("invokes onTabChange when another tab is selected", async () => {
    const onTabChange = vi.fn();
    render(<Tabs activeTab="overview" onTabChange={onTabChange} tabs={baseTabs} />);

    await user.click(screen.getByRole("tab", { name: "Details" }));

    expect(onTabChange).toHaveBeenCalledWith("details");
  });

  it("does not trigger onTabChange for disabled tabs", async () => {
    const tabsWithDisabled: TabItem[] = [
      baseTabs[0]!,
      { ...baseTabs[1]!, id: "disabled", label: "Disabled", disabled: true },
    ];
    const onTabChange = vi.fn();

    render(<Tabs activeTab="overview" onTabChange={onTabChange} tabs={tabsWithDisabled} />);

    const disabledTab = screen.getByRole("tab", { name: "Disabled" });
    expect(disabledTab).toBeDisabled();

    await user.click(disabledTab);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("renders badges when provided", () => {
    render(<Tabs activeTab="metrics" onTabChange={vi.fn()} tabs={baseTabs} />);

    expect(screen.getByTestId("badge")).toHaveTextContent("3");
  });
});
