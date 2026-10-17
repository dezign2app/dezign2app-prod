import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (val: string) => void;
  }) => (
    <div data-testid="mock-select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => <div title={title}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`item-${value}`}>{children}</div>,
  SelectSeparator: () => <hr />,
}));

vi.mock("@workspace/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import {
  AgentStateUpdatesSection,
  extractActionsFromReducerCode,
  getActionsForReducer,
} from "../AgentStateUpdatesSection";
import type {
  AgentNodeData,
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@workspace/canvas";

describe("AgentStateUpdatesSection Action & Reducer Helpers", () => {
  it("extracts action names from custom reducer code", () => {
    const customCode = `(prev, next) => {
      const action = next?.action;
      if (action === "increment") return prev + (next.value || 1);
      if (action === "decrement") return prev - (next.value || 1);
      if (action === "reset") return 0;
      if (action === "replace") return next.value;
      return prev;
    }`;

    const actions = extractActionsFromReducerCode(customCode);
    expect(actions).toContain("increment");
    expect(actions).toContain("decrement");
    expect(actions).toContain("reset");
    expect(actions).toContain("replace");
  });

  it("provides standard actions for number channel type", () => {
    const actions = getActionsForReducer("number", "count_reducer");
    const actionNames = actions.map((a) => a.action);

    expect(actionNames).toContain("default");
    expect(actionNames).toContain("increment");
    expect(actionNames).toContain("decrement");
    expect(actionNames).toContain("replace");
    expect(actionNames).toContain("reset");
  });

  it("provides standard actions for boolean channel type", () => {
    const actions = getActionsForReducer("boolean", "toggle_reducer");
    const actionNames = actions.map((a) => a.action);

    expect(actionNames).toContain("toggle");
    expect(actionNames).toContain("replace");
    expect(actionNames).toContain("reset");
  });
});

describe("AgentStateUpdatesSection Component", () => {
  const dummyAgentData: AgentNodeData = {
    id: "agent_1",
    name: "Test Agent",
    label: "Test Agent",
    pipelineSteps: [],
    stateUpdates: [
      {
        channelKey: "count",
        reducer: "count_reducer",
        action: "increment",
        source: "expression",
        value: "1",
      },
    ],
  };

  const dummyStateChannels: LangGraphStateChannel[] = [
    {
      key: "count",
      type: "number",
      reducer: "count_reducer",
      customReducerCode: `(prev, next) => next?.action === "increment" ? prev + (next.value || 1) : next?.value ?? prev`,
    },
    { key: "messages", type: "messages", reducer: "add_messages" },
  ];

  const dummyCustomReducers: LangGraphCustomReducer[] = [
    {
      id: "cr_1",
      name: "count_reducer",
      targetField: "count",
      code: `(prev, next) => next?.action === "increment" ? prev + 1 : prev`,
    },
  ];

  it("renders state updates header, column titles, and action mapping", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentStateUpdatesSection
        selectedAgentData={dummyAgentData}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        customReducers={dummyCustomReducers}
      />,
    );

    expect(screen.getByText("Graph State Updates")).toBeDefined();
    expect(screen.getByText("State Channel & Reducer")).toBeDefined();
    expect(screen.getByText("Reducer Action")).toBeDefined();
    expect(screen.getByText("New Value (Source)")).toBeDefined();

    // Verify Feeds text previews the action and value
    expect(screen.getByText(/action:\s*"increment"/)).toBeDefined();
    expect(screen.getAllByText("count_reducer").length).toBeGreaterThan(0);
  });

  it("adds a new state update with default action and reducer", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{ ...dummyAgentData, stateUpdates: [] }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        customReducers={dummyCustomReducers}
      />,
    );

    const addBtn = screen.getByText("Add Update");
    fireEvent.click(addBtn);

    expect(onUpdateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        stateUpdates: expect.arrayContaining([
          expect.objectContaining({
            channelKey: "count",
            reducer: "count_reducer",
            action: "default",
          }),
        ]),
      }),
    );
  });
});
