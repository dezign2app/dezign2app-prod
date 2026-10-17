import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@workspace/ui/components/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@workspace/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (c: boolean) => void }) => (
    <button role="switch" aria-checked={Boolean(checked)} onClick={() => onCheckedChange?.(!checked)} />
  ),
}));

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (val: string) => void }) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`item-${value}`}>{children}</div>
  ),
  SelectSeparator: () => <hr />,
}));

// Mock sub-components not needed for prompt variable testing
vi.mock("../AgentAttachedComponentsSection", () => ({
  AgentAttachedComponentsSection: () => <div data-testid="attached-components" />,
}));
vi.mock("../AgentMiddlewareSection", () => ({
  AgentMiddlewareSection: () => <div data-testid="middleware-section" />,
}));
vi.mock("../AgentStructuredOutputSection", () => ({
  AgentStructuredOutputSection: () => <div data-testid="structured-output-section" />,
}));
vi.mock("../AgentEventStreamingSection", () => ({
  AgentEventStreamingSection: () => <div data-testid="event-streaming-section" />,
}));

import { AgentLlmStepContent } from "../AgentLlmStepContent";
import type {
  AgentNodeData,
  LangGraphStateChannel,
  LangGraphNodePipelineStep,
} from "@workspace/canvas";

describe("AgentLlmStepContent Prompt Variable Insertion", () => {
  const dummyAgentData: AgentNodeData = {
    id: "agent_node_1",
    name: "Test Agent",
    label: "Test Agent",
    systemPrompt: "Answer concisely.",
    pipelineSteps: [],
  };

  const dummyStateChannels: LangGraphStateChannel[] = [
    { key: "msg", type: "string", reducer: "replace" },
  ];

  const dummyPriorSteps: LangGraphNodePipelineStep[] = [
    {
      id: "step_trans_1",
      type: "transformer",
      outputVariable: "step1Result",
      outputSchema: [{ name: "field1", type: "string" }],
    },
  ];

  it("renders the prompt textarea and cascading variable picker", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentLlmStepContent
        selectedAgentData={dummyAgentData}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        priorSteps={dummyPriorSteps}
        rfConfig={{ enabled: false }}
        updateResponseFormat={vi.fn()}
        isMiddlewareEnabled={false}
        handleToggleMiddlewareConfig={vi.fn()}
      />,
    );

    expect(screen.getByText("System Prompt")).toBeDefined();
    expect(screen.getByText("Variable:")).toBeDefined();
    expect(screen.getByText("Add ${state.msg}")).toBeDefined();
  });

  it("inserts variable into prompt on Add button click", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentLlmStepContent
        selectedAgentData={dummyAgentData}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        priorSteps={dummyPriorSteps}
        rfConfig={{ enabled: false }}
        updateResponseFormat={vi.fn()}
        isMiddlewareEnabled={false}
        handleToggleMiddlewareConfig={vi.fn()}
      />,
    );

    const addBtn = screen.getByText("Add ${state.msg}");
    fireEvent.click(addBtn);

    expect(onUpdateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("${state.msg}"),
      }),
    );
  });
});
