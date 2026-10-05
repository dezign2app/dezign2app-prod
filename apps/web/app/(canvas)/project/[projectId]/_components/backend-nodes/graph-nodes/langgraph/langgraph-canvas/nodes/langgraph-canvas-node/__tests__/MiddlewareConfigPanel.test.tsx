import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MiddlewareConfigPanel } from "../MiddlewareConfigPanel";
import { ReactFlowProvider } from "@xyflow/react";

vi.mock("@workspace/ui/components/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    onClick,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (c: boolean) => void;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
  }) => (
    <button
      role="switch"
      aria-checked={Boolean(checked)}
      onClick={(e) => {
        onClick?.(e);
        onCheckedChange?.(!checked);
      }}
      {...props}
    />
  ),
}));

// Mock ReactFlow
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    useReactFlow: () => ({
      getNodes: () => [
        {
          id: "mw_ref_1",
          type: "langgraph_middleware_ref",
          data: { label: "Rate Limiter (Ref)", type: "rate_limit" },
        },
      ],
      setNodes: vi.fn(),
      getEdges: () => [],
      setEdges: vi.fn(),
    }),
  };
});

describe("MiddlewareConfigPanel", () => {
  it("renders disabled state with off badge and toggles on", () => {
    const onToggle = vi.fn();
    render(
      <ReactFlowProvider>
        <MiddlewareConfigPanel
          middlewareConfig={{ enabled: false }}
          boundMiddlewares={[]}
          handleToggleMiddlewareConfig={onToggle}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText("Middleware")).toBeDefined();
    expect(screen.getByText("Middleware pipeline disabled")).toBeDefined();

    const switchEl = screen.getByRole("switch");
    expect(switchEl.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(switchEl);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("renders active middlewares when enabled", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    const mockEdge = {
      id: "edge-1",
      source: "mw_ref_1",
      target: "agent-1",
    };

    render(
      <ReactFlowProvider>
        <MiddlewareConfigPanel
          middlewareConfig={{ enabled: true }}
          boundMiddlewares={[mockEdge]}
          handleToggleMiddlewareConfig={onToggle}
          handleRemoveMiddleware={onRemove}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText("Interceptors & guards active")).toBeDefined();
    expect(screen.getByText("1 active")).toBeDefined();
    expect(screen.getByText("Rate Limiter (Ref)")).toBeDefined();
    expect(screen.getByText("REF")).toBeDefined();

    const trashBtn = screen.getByTitle("Remove middleware reference");
    fireEvent.click(trashBtn);
    expect(onRemove).toHaveBeenCalledWith("mw_ref_1");
  });
});
