import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangGraphInvokeStepSection } from "../LangGraphInvokeStepSection";
import { PipelineStepDraft, AvailableSource } from "../types";
import { BackendNode } from "@workspace/canvas/types";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => (
    <button role="combobox" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, children }: any) => (
    <span>{children || placeholder}</span>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="mock-select-item" data-value={value}>
      {children}
    </div>
  ),
}));

vi.mock("@workspace/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("../BindingSourceEditor", () => ({
  BindingSourceEditor: ({ binding, onChange }: any) => (
    <div data-testid={`mock-binding-editor-${binding.argName}`}>
      <button
        onClick={() =>
          onChange({
            ...binding,
            source: { kind: "req_body", field: "custom_field" },
          })
        }
      >
        Update Binding
      </button>
    </div>
  ),
}));

describe("LangGraphInvokeStepSection Payload Mapping", () => {
  const mockAgentNode: BackendNode = {
    id: "agent-1",
    type: "langgraph",
    fractionalIndex: "a1",
    position: { x: 0, y: 0 },
    data: {
      label: "Support Agent",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages" },
        { key: "current_message", type: "string", reducer: "replace" },
      ],
    },
  };

  const mockAvailableSources: AvailableSource[] = [
    {
      id: "req_body",
      label: "Request Body (body)",
      kind: "req_body",
      paths: [
        { path: "message", type: "string" },
        { path: "current_message", type: "string" },
      ],
    },
  ];

  it("renders delete buttons for mapped channels and removes channel on click", () => {
    const step: PipelineStepDraft = {
      id: "step-1",
      name: "Invoke Support Agent",
      type: "langgraph_invoke",
      langGraphTargetNodeId: "agent-1",
      langGraphStateMapping: {
        messages: "body.message",
        current_message: "body.current_message",
      },
      inputBindings: [
        { argName: "messages", source: { kind: "req_body", field: "message" } },
        { argName: "current_message", source: { kind: "req_body", field: "current_message" } },
      ],
    };

    const handleChange = vi.fn();

    render(
      <LangGraphInvokeStepSection
        step={step}
        allNodes={[mockAgentNode]}
        availableSources={mockAvailableSources}
        onChange={handleChange}
      />
    );

    // Both mapped channels should be visible in the table
    expect(screen.getAllByText("messages")[0]).toBeInTheDocument();
    expect(screen.getByText("current_message")).toBeInTheDocument();

    // Click delete on current_message
    const removeButtons = screen.getAllByTitle("Remove mapping");
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]!);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updatedStep = handleChange.mock.calls[0]![0]!;

    // current_message should be deleted from both langGraphStateMapping and inputBindings
    expect(updatedStep.langGraphStateMapping).toEqual({
      messages: "body.message",
    });
    expect(updatedStep.inputBindings).toEqual([
      { argName: "messages", source: { kind: "req_body", field: "message" } },
    ]);
  });

  it("does not render unmapped channels as mapped rows, and shows them under available channels", () => {
    const stepWithOnlyMessages: PipelineStepDraft = {
      id: "step-1",
      name: "Invoke Support Agent",
      type: "langgraph_invoke",
      langGraphTargetNodeId: "agent-1",
      langGraphStateMapping: {
        messages: "body.message",
      },
      inputBindings: [
        { argName: "messages", source: { kind: "req_body", field: "message" } },
      ],
    };

    const handleChange = vi.fn();

    render(
      <LangGraphInvokeStepSection
        step={stepWithOnlyMessages}
        allNodes={[mockAgentNode]}
        availableSources={mockAvailableSources}
        onChange={handleChange}
      />
    );

    // Only messages should be in the mapped table with a remove button
    const removeButtons = screen.getAllByTitle("Remove mapping");
    expect(removeButtons).toHaveLength(1);

    // current_message should appear under available channels
    const addChannelButton = screen.getByTitle("Map channel: current_message (string)");
    expect(addChannelButton).toBeInTheDocument();

    // Clicking it maps current_message
    fireEvent.click(addChannelButton);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updatedStep = handleChange.mock.calls[0]![0]!;
    expect(updatedStep.langGraphStateMapping.current_message).toBeDefined();
    expect(updatedStep.inputBindings.some((b: any) => b.argName === "current_message")).toBe(true);
  });

  it("shows empty state when no channels are mapped and allows auto-mapping", () => {
    const emptyStep: PipelineStepDraft = {
      id: "step-1",
      name: "Invoke Support Agent",
      type: "langgraph_invoke",
      langGraphTargetNodeId: "agent-1",
      langGraphStateMapping: {},
      inputBindings: [],
    };

    const handleChange = vi.fn();

    render(
      <LangGraphInvokeStepSection
        step={emptyStep}
        allNodes={[mockAgentNode]}
        availableSources={mockAvailableSources}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("No payload channels mapped yet. The agent will run with its default state.")).toBeInTheDocument();

    const autoMapBtn = screen.getByTitle("Auto-map default payload fields");
    fireEvent.click(autoMapBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updatedStep = handleChange.mock.calls[0]![0]!;
    expect(updatedStep.langGraphStateMapping.messages).toBeDefined();
    expect(updatedStep.langGraphStateMapping.current_message).toBeDefined();
  });

  it("renders Session Thread ID section and auto-maps thread_id when agent has checkpointer memory enabled", () => {
    const memoryAgentNode: BackendNode = {
      id: "agent-mem-1",
      type: "langgraph",
      fractionalIndex: "a2",
      position: { x: 0, y: 0 },
      data: {
        label: "Memory Chatbot",
        memoryConfig: {
          enabled: true,
          checkpointer: "postgres",
        },
        stateChannels: [
          { key: "messages", type: "messages", reducer: "add_messages" },
        ],
      },
    };

    const step: PipelineStepDraft = {
      id: "step-mem-1",
      name: "Invoke Memory Chatbot",
      type: "langgraph_invoke",
      langGraphTargetNodeId: "agent-mem-1",
      langGraphStateMapping: {
        messages: "body.message",
      },
      inputBindings: [
        { argName: "messages", source: { kind: "req_body", field: "message" } },
      ],
    };

    const handleChange = vi.fn();

    render(
      <LangGraphInvokeStepSection
        step={step}
        allNodes={[memoryAgentNode]}
        availableSources={mockAvailableSources}
        onChange={handleChange}
      />
    );

    // Thread ID header and checkpointer badge should be rendered
    expect(screen.getByText("Session Thread ID (Checkpointer Memory)")).toBeInTheDocument();
    expect(screen.getByText("postgres checkpointer")).toBeInTheDocument();
    // Hint for messages channel history loaded from DB
    expect(screen.getByText("new input only (history from DB)")).toBeInTheDocument();

    // Auto-map should include thread_id source
    const autoMapBtn = screen.getByTitle("Auto-map default payload fields");
    fireEvent.click(autoMapBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updatedStep = handleChange.mock.calls[0]![0]!;
    expect(updatedStep.langGraphThreadIdSource).toBe("body.thread_id");
  });
});
