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

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <div onClick={onClick}>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  generateDispatchBodyForChannel,
} from "../AgentStateUpdatesSection";
import type {
  AgentNodeData,
  LangGraphStateChannel,
  LangGraphCustomReducer,
  CustomTypeItem,
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

  it("extracts action names from array includes style", () => {
    const customCode = `(prev, next) => {
      const action = next?.action;
      if (["reset", "clear"].includes(action)) return [];
      if (action === "replace") return next.value;
      return prev;
    }`;

    const actions = extractActionsFromReducerCode(customCode);
    expect(actions).toContain("reset");
    expect(actions).toContain("clear");
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
    expect(screen.getByText("1. State Channel")).toBeDefined();
    expect(screen.getByText("2. Reducer Action")).toBeDefined();
    expect(screen.getByText("3. New Value / Mapping")).toBeDefined();

    // Verify Dispatches text previews the action and value
    expect(screen.getByText(/action:\s*"increment"/)).toBeDefined();
    expect(screen.getAllByText("count_reducer").length).toBeGreaterThan(0);
  });

  it("renders 'No value required' when a valueless action like reset is selected", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{
          ...dummyAgentData,
          stateUpdates: [
            {
              channelKey: "count",
              reducer: "count_reducer",
              action: "reset",
              source: "none",
            },
          ],
        }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        customReducers={dummyCustomReducers}
      />,
    );

    expect(screen.getByText(/No value required/)).toBeDefined();
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

  it("renders value input and allows typing inline or mapping from steps", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{
          ...dummyAgentData,
          stateUpdates: [
            {
              channelKey: "count",
              reducer: "count_reducer",
              action: "increment",
              value: "5",
              source: "literal",
            },
          ],
        }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={dummyStateChannels}
        customReducers={dummyCustomReducers}
      />,
    );

    const input = screen.getByDisplayValue("5");
    expect(input).toBeDefined();

    // Map button should be present
    expect(screen.getByText("Map")).toBeDefined();

    // Type a new value inline and blur to flush LocalInput debounce
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.blur(input);
    expect(onUpdateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        stateUpdates: expect.arrayContaining([
          expect.objectContaining({
            value: "10",
            action: "increment",
          }),
        ]),
      }),
    );
  });

  it("renders JSON textarea for json channel types and allows reference insertion", () => {
    const onUpdateAgent = vi.fn();

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{
          ...dummyAgentData,
          stateUpdates: [
            {
              channelKey: "payload",
              reducer: "replace",
              action: "default",
              value: "{}",
              source: "literal",
            },
          ],
        }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={[
          {
            key: "payload",
            type: "object",
            reducer: "replace",
          },
        ]}
      />,
    );

    // Textarea should be rendered for json channel
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDefined();

    // Mode toggle button should show "JSON Active"
    expect(screen.getByText("JSON Active")).toBeDefined();

    // Reference insertion helper button should be present
    expect(screen.getAllByText(/Insert/).length).toBeGreaterThan(0);
  });

  it("supports custom type channel with fields in reference steps mapping and identifies custom type", () => {
    const onUpdateAgent = vi.fn();
    const customUserType: CustomTypeItem = {
      id: "type_user",
      name: "UserProfile",
      kind: "interface",
      fields: [
        { id: "f1", name: "userId", type: "string" },
        { id: "f2", name: "email", type: "string" },
      ],
    };

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{
          ...dummyAgentData,
          stateUpdates: [
            {
              channelKey: "currentUser",
              reducer: "replace",
              action: "default",
              value: "{}",
              source: "literal",
            },
          ],
        }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={[
          {
            key: "currentUser",
            type: "object",
            reducer: "replace",
            customTypeId: "type_user",
            customTypeName: "UserProfile",
            customTypeSchema: customUserType,
          },
        ]}
      />,
    );

    expect(screen.getByRole("textbox")).toBeDefined();
    expect(screen.getAllByText(/Insert/).length).toBeGreaterThan(0);

    // Channel dropdown should identify custom type UserProfile instead of generic [object]
    expect(screen.getByText("[UserProfile]")).toBeDefined();

    // Footer contract should show channel: UserProfile
    expect(screen.getByText("UserProfile")).toBeDefined();

    // Textarea placeholder should contain fields from UserProfile
    expect(screen.getByPlaceholderText(/userId/)).toBeDefined();
  });

  it("generateDispatchBodyForChannel creates formatted JSON matching schema fields and types", () => {
    const customUserType: CustomTypeItem = {
      id: "type_user",
      name: "UserProfile",
      kind: "interface",
      fields: [
        { id: "f1", name: "userId", type: "string" },
        { id: "f2", name: "email", type: "string" },
        { id: "f3", name: "age", type: "number" },
        { id: "f4", name: "isAdmin", type: "boolean" },
        { id: "f5", name: "roles", type: "string[]" },
      ],
    };

    const channel: LangGraphStateChannel = {
      key: "currentUser",
      type: "object",
      reducer: "replace",
      customTypeSchema: customUserType,
    };

    const schemaFields = [
      { name: "userId", type: "string" },
    ];

    const body = generateDispatchBodyForChannel(
      channel,
      [customUserType],
      schemaFields,
      [],
      "response.content",
    );

    expect(body).toContain('"userId": `${response.userId}`');
    expect(body).toContain('"email": `${response.email}`');
    expect(body).toContain('"age": 0');
    expect(body).toContain('"isAdmin": false');
    expect(body).toContain('"roles": []');

    const evalFn = new Function("response", `return (${body});`);
    const evaluated = evalFn({ userId: "u123", email: "test@example.com" });
    expect(evaluated.userId).toBe("u123");
    expect(evaluated.email).toBe("test@example.com");
    expect(evaluated.age).toBe(0);
    expect(evaluated.isAdmin).toBe(false);
    expect(evaluated.roles).toEqual([]);
  });

  it("renders auto-generate body helper when textarea is empty and populates body on click", () => {
    const onUpdateAgent = vi.fn();
    const customUserType: CustomTypeItem = {
      id: "type_user",
      name: "UserProfile",
      kind: "interface",
      fields: [
        { id: "f1", name: "id", type: "string" },
        { id: "f2", name: "name", type: "string" },
      ],
    };

    render(
      <AgentStateUpdatesSection
        selectedAgentData={{
          ...dummyAgentData,
          stateUpdates: [
            {
              channelKey: "demo",
              reducer: "demo_reducer",
              action: "default",
              value: "",
              source: "literal",
            },
          ],
        }}
        onUpdateAgent={onUpdateAgent}
        stateChannels={[
          {
            key: "demo",
            type: "object",
            reducer: "demo_reducer",
            customTypeName: "UserProfile",
            customTypeSchema: customUserType,
          },
        ]}
      />,
    );

    // Empty banner should be present
    expect(
      screen.getByText(/Dispatch body is empty. Generate template for/),
    ).toBeDefined();

    // Auto-Generate Body buttons should be present in toolbar, banner, and quick chips
    const generateButtons = screen.getAllByRole("button", { name: /Generate/i });
    expect(generateButtons.length).toBeGreaterThan(0);

    // Click the Auto-Generate Body button
    fireEvent.click(generateButtons[0]!);

    expect(onUpdateAgent).toHaveBeenCalled();
    const lastCall = onUpdateAgent.mock.calls[onUpdateAgent.mock.calls.length - 1]![0];
    const updatedValue = lastCall.stateUpdates[0].value;
    const evalFn = new Function("response", `return (${updatedValue});`);
    const parsed = evalFn({ id: "123", name: "test" });
    expect(parsed.id).toBe("123");
    expect(parsed.name).toBe("test");
  });
});
