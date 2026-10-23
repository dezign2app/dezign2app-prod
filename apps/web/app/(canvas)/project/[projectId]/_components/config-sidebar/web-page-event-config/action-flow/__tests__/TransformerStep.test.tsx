import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransformerStep } from "../TransformerStep";
import type { BackendNode, FrontendActionStepDraft } from "@workspace/canvas";

interface MockSelectProps {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (val: string) => void;
}

interface MockSelectSubComponentProps {
  children?: React.ReactNode;
}

interface MockSelectValueProps {
  placeholder?: string;
}

interface MockSelectItemProps {
  children?: React.ReactNode;
  value?: string;
}

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value }: MockSelectProps) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: MockSelectSubComponentProps) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: MockSelectValueProps) => <span>{placeholder}</span>,
  SelectContent: ({ children }: MockSelectSubComponentProps) => <div>{children}</div>,
  SelectItem: ({ children, value }: MockSelectItemProps) => (
    <div data-value={value}>{children}</div>
  ),
}));

describe("TransformerStep component", () => {
  const mockTransformerNode: BackendNode = {
    id: "trans-node-1",
    type: "transformer",
    position: { x: 500, y: 300 },
    fractionalIndex: "a0",
    data: {
      label: "cleanUserData",
      functionName: "cleanUserData",
      description: "Cleanses user registration payload",
      scope: "global",
      inputSchema: [
        { id: "p1", name: "email", type: "string", required: true },
        { id: "p2", name: "age", type: "number", required: false },
      ],
      returnSchema: [
        { id: "r1", name: "sanitizedEmail", type: "string", required: true },
      ],
    },
  };

  const initialDraft: FrontendActionStepDraft = {
    id: "step-1",
    order: 1,
    type: "transform",
    name: "cleanUserDataResult",
    outputVariable: "cleanUserDataResult",
    transformerNodeId: "trans-node-1",
    transformerName: "cleanUserData",
    transformBindings: [
      { argName: "email", source: { kind: "literal", value: "user@example.com" } },
      { argName: "age", source: { kind: "literal", value: "25" } },
    ],
  };

  it("renders transformer function title and selected transformer details", () => {
    const handleChange = vi.fn();

    render(
      <TransformerStep
        draft={initialDraft}
        allSteps={[initialDraft]}
        stepIndex={0}
        allNodes={[mockTransformerNode]}
        webPageNodeId="wp-1"
        actionId="act-submit"
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("Transformer Function")).toBeDefined();
    expect(screen.getByText("New Transformer Node")).toBeDefined();
    expect(screen.getAllByText("cleanUserData").length).toBeGreaterThan(0);
    expect(screen.getByText("GLOBAL")).toBeDefined();
    expect(screen.getByText("Cleanses user registration payload")).toBeDefined();
    expect(screen.getByText("sanitizedEmail: string")).toBeDefined();
  });

  it("updates output variable when modified", () => {
    const handleChange = vi.fn();

    render(
      <TransformerStep
        draft={initialDraft}
        allSteps={[initialDraft]}
        stepIndex={0}
        allNodes={[mockTransformerNode]}
        webPageNodeId="wp-1"
        actionId="act-submit"
        onChange={handleChange}
      />,
    );

    const input = screen.getByPlaceholderText("e.g. transformedData, formatResult");
    expect(input).toHaveProperty("value", "cleanUserDataResult");

    fireEvent.change(input, { target: { value: "sanitizedOutput" } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outputVariable: "sanitizedOutput",
        name: "sanitizedOutput",
      }),
    );
  });

  it("renders input arguments bindings for schema fields", () => {
    const handleChange = vi.fn();

    render(
      <TransformerStep
        draft={initialDraft}
        allSteps={[initialDraft]}
        stepIndex={0}
        allNodes={[mockTransformerNode]}
        webPageNodeId="wp-1"
        actionId="act-submit"
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("email")).toBeDefined();
    expect(screen.getByText("age")).toBeDefined();
    expect(screen.getByDisplayValue("user@example.com")).toBeDefined();
    expect(screen.getByDisplayValue("25")).toBeDefined();
  });
});
