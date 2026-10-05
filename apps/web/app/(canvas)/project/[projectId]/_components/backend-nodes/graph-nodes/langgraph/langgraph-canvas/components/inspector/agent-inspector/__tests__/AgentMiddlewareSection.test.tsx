import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentMiddlewareSection } from "../AgentMiddlewareSection";
import type { MiddlewareNode, LangGraphMiddlewareRefNode } from "@workspace/canvas";

interface MockSwitchProps {
  checked?: boolean;
  onCheckedChange?: (c: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
}

vi.mock("@workspace/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange, onClick }: MockSwitchProps) => (
    <button
      role="switch"
      aria-checked={Boolean(checked)}
      onClick={(e) => {
        onClick?.(e);
        onCheckedChange?.(!checked);
      }}
    />
  ),
}));

interface MockChildrenProps {
  children?: React.ReactNode;
}

interface MockComboboxInputProps {
  placeholder?: string;
  disabled?: boolean;
}

interface MockComboboxListProps {
  children?:
    | React.ReactNode
    | ((item: {
        value: string;
        label: string;
        type: string;
        isAttached: boolean;
      }) => React.ReactNode);
}

vi.mock("@workspace/ui/components/combobox", () => ({
  Combobox: ({ children }: MockChildrenProps) => (
    <div data-testid="mock-combobox">{children}</div>
  ),
  ComboboxInput: ({ placeholder, disabled }: MockComboboxInputProps) => (
    <input
      placeholder={placeholder}
      disabled={disabled}
      data-testid="combobox-input"
    />
  ),
  ComboboxContent: ({ children }: MockChildrenProps) => <div>{children}</div>,
  ComboboxList: ({ children }: MockComboboxListProps) => (
    <div>{typeof children === "function" ? null : children}</div>
  ),
  ComboboxItem: ({ children }: MockChildrenProps) => <div>{children}</div>,
  ComboboxEmpty: ({ children }: MockChildrenProps) => <div>{children}</div>,
}));

describe("AgentMiddlewareSection", () => {
  const mockMasterMw: MiddlewareNode = {
    id: "mw_master_1",
    type: "langgraph_middleware",
    position: { x: 0, y: 0 },
    data: {
      label: "Rate Limiter",
      name: "Rate Limiter",
      type: "rate_limit",
      middlewareId: "mw_master_1",
    },
  };

  const mockMwRef: LangGraphMiddlewareRefNode = {
    id: "mw_ref_1",
    type: "langgraph_middleware_ref",
    position: { x: 100, y: 100 },
    data: {
      label: "Rate Limiter (Ref)",
      refId: "mw_ref_1",
      middlewareRef: "mw_master_1",
    },
  };

  it("renders disabled state with banner and toggles on", () => {
    const onToggle = vi.fn();

    render(
      <AgentMiddlewareSection
        isEnabled={false}
        onToggleEnabled={onToggle}
        connectedMiddlewareIds={[]}
        masterMiddlewareNodes={[mockMasterMw]}
      />,
    );

    expect(screen.getByText("Middleware Execution")).toBeDefined();
    expect(screen.getByText("Off")).toBeDefined();
    expect(screen.getByText("Middleware Pipeline Disabled")).toBeDefined();

    const enableBtn = screen.getByText("Enable Middleware");
    fireEvent.click(enableBtn);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("renders enabled state with attached middleware and triggers removal", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();

    render(
      <AgentMiddlewareSection
        isEnabled={true}
        onToggleEnabled={onToggle}
        connectedMiddlewareIds={["mw_ref_1"]}
        availableMiddlewareNodes={[mockMwRef]}
        masterMiddlewareNodes={[mockMasterMw]}
        onRemoveMiddlewareRef={onRemove}
      />,
    );

    expect(screen.getByText("1 active")).toBeDefined();
    expect(screen.getByText("Pre- and post-processing interceptors active")).toBeDefined();
    expect(screen.getByText("Rate Limiter")).toBeDefined();
    expect(screen.getByText("REF")).toBeDefined();

    const removeBtn = screen.getByTitle("Remove middleware reference");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith("mw_ref_1");
  });

  it("renders empty attached list message when enabled but no refs attached", () => {
    render(
      <AgentMiddlewareSection
        isEnabled={true}
        onToggleEnabled={vi.fn()}
        connectedMiddlewareIds={[]}
        masterMiddlewareNodes={[mockMasterMw]}
      />,
    );

    expect(
      screen.getByText(
        "No middleware attached yet. Select one above and click Attach.",
      ),
    ).toBeDefined();
  });
});
