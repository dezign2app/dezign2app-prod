import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { ArgumentBindingsSection } from "../ArgumentBindingsSection";
import { useStepRowState } from "../useStepRowState";
import { StepBinding, ExpectedArg, AvailableSource, PipelineStepDraft } from "../types";
import { Endpoint, BackendNode } from "@workspace/canvas/types";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <button role="combobox" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) => (
    <span>{children || placeholder}</span>
  ),
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid="mock-select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectSeparator: () => <hr />,
}));

vi.mock("../StepCombobox", () => ({
  StepCombobox: ({
    value,
    options = [],
    className,
    placeholder,
    footerAction,
  }: {
    value: string;
    options?: { value: string; label: string }[];
    className?: string;
    placeholder?: string;
    footerAction?: { label: string; onSelect: () => void };
  }) => (
    <div data-testid="mock-combobox">
      <button role="combobox" className={className}>
        {value || placeholder}
      </button>
      {options.map((opt) => (
        <div key={opt.value} data-testid="mock-select-item" data-value={opt.value}>
          {opt.label}
        </div>
      ))}
      {footerAction && (
        <div data-testid="mock-select-item" data-value="__custom__">
          {footerAction.label}
        </div>
      )}
    </div>
  ),
}));

vi.mock("../BindingSourceEditor", () => ({
  BindingSourceEditor: () => <div data-testid="mock-binding-source-editor" />,
}));

const mockExpectedArgs: ExpectedArg[] = [
  { name: "conversationId", type: "TEXT", required: true },
  { name: "text", type: "TEXT", required: true },
];

const mockAvailableSources: AvailableSource[] = [
  {
    id: "req_body",
    label: "Request Body (body)",
    kind: "req_body",
    paths: [
      { path: "conversationId", type: "string" },
      { path: "text", type: "string" },
    ],
  },
];

describe("ArgumentBindingsSection", () => {

  it("renders a dropdown trigger containing the function input variable when expectedArgs are provided", () => {
    const bindings: StepBinding[] = [
      {
        argName: "conversationId",
        source: { kind: "req_body", field: "conversationId" },
      },
    ];

    render(
      <ArgumentBindingsSection
        bindings={bindings}
        expectedArgs={mockExpectedArgs}
        availableSources={mockAvailableSources}
        onAddBinding={vi.fn()}
        onUpdateBinding={vi.fn()}
        onRemoveBinding={vi.fn()}
        onAutoMapArguments={vi.fn()}
      />,
    );

    // Should render a dropdown trigger with "conversationId" text, not a plain input with value "conversationId"
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(screen.getAllByText("conversationId").length).toBeGreaterThanOrEqual(1);
    // Verify an input field with value "conversationId" is not rendered
    expect(screen.queryByDisplayValue("conversationId")).toBeNull();
  });

  it("renders a text input when expectedArgs is empty", () => {
    const bindings: StepBinding[] = [
      {
        argName: "customVar",
        source: { kind: "req_body", field: "customVar" },
      },
    ];

    render(
      <ArgumentBindingsSection
        bindings={bindings}
        expectedArgs={[]}
        availableSources={mockAvailableSources}
        onAddBinding={vi.fn()}
        onUpdateBinding={vi.fn()}
        onRemoveBinding={vi.fn()}
        onAutoMapArguments={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByDisplayValue("customVar")).toBeDefined();
  });

  it("calls onRemoveBinding when delete button is clicked", () => {
    const onRemove = vi.fn();
    const bindings: StepBinding[] = [
      {
        argName: "conversationId",
        source: { kind: "req_body", field: "conversationId" },
      },
    ];

    render(
      <ArgumentBindingsSection
        bindings={bindings}
        expectedArgs={mockExpectedArgs}
        availableSources={mockAvailableSources}
        onAddBinding={vi.fn()}
        onUpdateBinding={vi.fn()}
        onRemoveBinding={onRemove}
        onAutoMapArguments={vi.fn()}
      />,
    );

    const deleteBtn = screen.getByTitle("Remove argument");
    fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});

describe("useStepRowState: addBinding with expectedArgs", () => {
  const mockEndpoint: Endpoint = {
    id: "ep-msg",
    name: "Create Message",
    type: "POST",
    requestBody: {
      id: "rb-1",
      fields: [
        { id: "f-1", name: "conversationId", type: "string", required: true },
        { id: "f-2", name: "text", type: "string", required: true },
      ],
    },
  };

  const mockTableNode: BackendNode = {
    id: "table-messages",
    type: "entity",
    position: { x: 0, y: 0 },
    fractionalIndex: "a0",
    data: {
      label: "messages",
      tableRef: "messages",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "conversationId", type: "string", isNotNull: true },
        { name: "text", type: "string", isNotNull: true },
      ],
    },
  };

  it("automatically binds next unbound function argument when addBinding is called", () => {
    const step: PipelineStepDraft = {
      id: "step-1",
      name: "createMessageResult",
      type: "db_operation",
      enabled: true,
      outputVariable: "createMessageResult",
      tableNodeId: "table-messages",
      operationId: "createMessage",
      functionRef: { name: "createMessage", importPath: "@workspace/db/helpers/messages" },
      inputBindings: [
        {
          argName: "conversationId",
          source: { kind: "req_body", field: "conversationId" },
        },
      ],
    };

    let updatedStep: PipelineStepDraft = step;
    const onChange = vi.fn((updated) => {
      updatedStep = updated;
    });

    const { result } = renderHook(() =>
      useStepRowState({
        step,
        index: 0,
        priorSteps: [],
        endpoint: mockEndpoint,
        allNodes: [mockTableNode],
        allEdges: [],
        onChange,
      }),
    );

    act(() => {
      result.current.addBinding();
    });

    expect(onChange).toHaveBeenCalled();
    expect(updatedStep.inputBindings).toHaveLength(2);
    const secondBinding = updatedStep.inputBindings?.[1];
    expect(secondBinding?.argName).toBe("text");
    expect(secondBinding?.source).toEqual({ kind: "req_body", field: "text" });
  });

  it("filters out empty, null, or undefined expectedArg names without rendering invalid select items", () => {
    const mixedExpectedArgs: Array<{ name?: string | null; type?: string; required?: boolean }> = [
      { name: "validArg", type: "string", required: true },
      { name: "", type: "string", required: false },
      { name: "   ", type: "string", required: false },
      { name: undefined, type: "string", required: false },
      { name: null, type: "string", required: false },
    ];

    const bindings: StepBinding[] = [
      {
        argName: "validArg",
        source: { kind: "req_body", field: "validArg" },
      },
    ];

    render(
      <ArgumentBindingsSection
        bindings={bindings}
        expectedArgs={mixedExpectedArgs}
        availableSources={mockAvailableSources}
        onAddBinding={vi.fn()}
        onUpdateBinding={vi.fn()}
        onRemoveBinding={vi.fn()}
        onAutoMapArguments={vi.fn()}
      />,
    );

    const selectItems = screen.getAllByTestId("mock-select-item");
    const values = selectItems.map((item) => item.getAttribute("data-value"));
    expect(values).toContain("validArg");
    expect(values).toContain("__custom__");
    expect(values).not.toContain("");
    expect(values).not.toContain("   ");
    expect(values).not.toContain("undefined");
    expect(values).not.toContain("null");
  });

  it("renders a duplicate argument warning when duplicate argument names exist in bindings", () => {
    const duplicateBindings: StepBinding[] = [
      {
        argName: "data",
        source: { kind: "req_body", field: "data" },
      },
      {
        argName: "data",
        source: { kind: "step_output", stepId: "step_1", field: "" },
      },
    ];

    render(
      <ArgumentBindingsSection
        bindings={duplicateBindings}
        expectedArgs={[]}
        availableSources={mockAvailableSources}
        onAddBinding={vi.fn()}
        onUpdateBinding={vi.fn()}
        onRemoveBinding={vi.fn()}
        onAutoMapArguments={vi.fn()}
      />,
    );

    const warnings = screen.getAllByText(/Duplicate argument/i);
    expect(warnings.length).toBe(2);
  });

  it("generates a unique arg_N name in useStepRowState when all expectedArgs are already bound", () => {
    let updatedStep: PipelineStepDraft = {
      id: "step_test",
      name: "Test Step",
      type: "transform",
      enabled: true,
      inputBindings: [
        { argName: "conversationId", source: { kind: "req_body", field: "conversationId" } },
        { argName: "text", source: { kind: "req_body", field: "text" } },
      ],
    };

    const onChange = vi.fn((step: PipelineStepDraft) => {
      updatedStep = step;
    });

    const { result } = renderHook(() =>
      useStepRowState({
        step: updatedStep,
        index: 0,
        priorSteps: [],
        allNodes: [],
        allEdges: [],
        extraSources: [],
        onChange,
      }),
    );

    act(() => {
      result.current.addBinding();
    });

    expect(onChange).toHaveBeenCalled();
    expect(updatedStep.inputBindings).toHaveLength(3);
    const thirdBinding = updatedStep.inputBindings?.[2];
    expect(thirdBinding?.argName).toBe("arg_3");
  });
});
