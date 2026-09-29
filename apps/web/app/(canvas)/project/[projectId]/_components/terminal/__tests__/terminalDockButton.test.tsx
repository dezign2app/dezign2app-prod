import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalDockButton } from "../components/TerminalDockButton";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("TerminalDockButton", () => {
  it("renders the Terminal tab on LangGraph Studio route when closed", () => {
    mockUsePathname.mockReturnValue("/project/proj-1/langgraph/node-agent-1");

    render(
      <TerminalDockButton
        isOpen={false}
        onToggleOpen={() => {}}
        sessionCount={1}
        hasRunningSession={false}
      />
    );

    expect(screen.getByText("Terminal")).toBeDefined();
    expect(screen.getByText("Toggle Terminal")).toBeDefined();
  });

  it("returns null when isOpen is true on LangGraph Studio route", () => {
    mockUsePathname.mockReturnValue("/project/proj-1/langgraph/node-agent-1");

    const { container } = render(
      <TerminalDockButton
        isOpen={true}
        onToggleOpen={() => {}}
        sessionCount={1}
        hasRunningSession={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("returns null on compiler route", () => {
    mockUsePathname.mockReturnValue("/project/proj-1/compiler");

    const { container } = render(
      <TerminalDockButton
        isOpen={false}
        onToggleOpen={() => {}}
        sessionCount={0}
        hasRunningSession={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
