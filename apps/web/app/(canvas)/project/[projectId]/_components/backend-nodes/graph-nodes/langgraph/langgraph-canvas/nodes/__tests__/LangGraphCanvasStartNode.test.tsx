import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangGraphCanvasStartNode } from "../LangGraphCanvasStartNode";
import { StartNode, LangGraphInputChannel, LangGraphStateChannel } from "@workspace/canvas";

type StartNodeProps = React.ComponentProps<typeof LangGraphCanvasStartNode>;

function createMockStartNode(data: StartNode["data"]): StartNodeProps {
  return {
    id: "start",
    data,
    selected: false,
  };
}

vi.mock("@xyflow/react", () => ({
  Handle: ({ id, className }: { id?: string; className?: string }) => (
    <div data-testid={`handle-${id}`} className={className} />
  ),
  Position: { Right: "right" },
}));

vi.mock("@workspace/ui/components/combobox", () => ({
  Combobox: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid="mock-combobox" data-value={value}>
      {children}
    </div>
  ),
  ComboboxInput: ({ placeholder, className }: { placeholder?: string; className?: string }) => (
    <input placeholder={placeholder} className={className} />
  ),
  ComboboxContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ComboboxList: ({ children }: { children?: React.ReactNode | ((item: string) => React.ReactNode) }) => (
    <div>{typeof children === "function" ? null : children}</div>
  ),
  ComboboxItem: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid="mock-combobox-item" data-value={value}>
      {children}
    </div>
  ),
  ComboboxEmpty: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe("LangGraphCanvasStartNode", () => {
  const stateChannels: LangGraphStateChannel[] = [
    { key: "messages", type: "messages", reducer: "add_messages" },
    { key: "message", type: "string", reducer: "replace" },
  ];

  it("displays incoming request channels and maps state channels when inputChannels are provided", () => {
    const inputChannels: LangGraphInputChannel[] = [
      {
        id: "inp-1",
        key: "message",
        type: "string",
        source: "request",
        stateChannelKey: "messages",
      },
      {
        id: "inp-2",
        key: "thread_id",
        type: "string",
        source: "request",
      },
    ];

    const mockNode = createMockStartNode({
      label: "START",
      inputChannels,
      stateChannels,
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    // Should NOT show "No endpoint connected"
    expect(screen.queryByText("No endpoint connected")).not.toBeInTheDocument();

    // Should show incoming request variables
    expect(screen.getAllByText("message").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("thread_id").length).toBeGreaterThanOrEqual(1);

    // State mapping header should show 1/2 state mapped
    expect(screen.getByText("1/2")).toBeInTheDocument();

    // State mapping row for messages should have value "inp-1" or "message"
    const selects = screen.getAllByTestId("mock-select");
    const messagesSelect = selects.find((s) => s.getAttribute("data-value") === "inp-1");
    expect(messagesSelect).toBeDefined();
  });

  it("supports comma-separated state channel mappings for multi-target input channels", () => {
    const inputChannels: LangGraphInputChannel[] = [
      {
        id: "inp-1",
        key: "message",
        type: "string",
        source: "request",
        stateChannelKey: "messages,message",
      },
    ];

    const mockNode = createMockStartNode({
      label: "START",
      inputChannels,
      stateChannels,
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    // State mapping header should show 2/2 state mapped
    expect(screen.getByText("2/2")).toBeInTheDocument();

    // Both state channel rows should resolve to inp-1
    const selects = screen.getAllByTestId("mock-select");
    const mappedSelects = selects.filter((s) => s.getAttribute("data-value") === "inp-1");
    expect(mappedSelects.length).toBe(2);
  });

  it("imports suggested params and preserves targetStateChannel mapping", () => {
    const handleAddSuggested = vi.fn();
    const mockNode = createMockStartNode({
      label: "START",
      inputChannels: [],
      stateChannels,
      suggestedParams: [
        {
          key: "message",
          type: "string",
          targetStateChannel: "messages",
          required: true,
        },
      ],
      onAddSuggestedChannel: handleAddSuggested,
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    // Shows suggestion for message
    expect(screen.getAllByText("message").length).toBeGreaterThanOrEqual(1);
    const suggestionRow = screen.getByTitle('Import "message" from endpoint');
    fireEvent.click(suggestionRow);

    expect(handleAddSuggested).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "message",
        source: "request",
        stateChannelKey: "messages",
      }),
    );
  });

  it("renders refresh/sync button and calls onRefreshInputs when clicked", () => {
    const onRefreshInputs = vi.fn();
    const mockNode = createMockStartNode({
      label: "START",
      inputChannels: [
        {
          id: "inp-1",
          key: "message",
          type: "string",
          source: "request",
        },
      ],
      stateChannels,
      onRefreshInputs,
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    const syncButton = screen.getByTitle("Check & sync configured input fields from connected endpoint");
    expect(syncButton).toBeInTheDocument();
    fireEvent.click(syncButton);

    expect(onRefreshInputs).toHaveBeenCalledTimes(1);
  });

  it("renders Check / Sync Inputs button when no inputs connected and calls onRefreshInputs", () => {
    const onRefreshInputs = vi.fn();
    const mockNode = createMockStartNode({
      label: "START",
      inputChannels: [],
      stateChannels,
      onRefreshInputs,
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    expect(screen.getByText("No endpoint connected")).toBeInTheDocument();
    const checkButton = screen.getByText("Check / Sync Inputs");
    expect(checkButton).toBeInTheDocument();
    fireEvent.click(checkButton);

    expect(onRefreshInputs).toHaveBeenCalledTimes(1);
  });

  it("shows ONLY what is mapped to the langgraph step and excludes unmapped endpoint fields", () => {
    const inputChannels: LangGraphInputChannel[] = [
      { id: "inp-1", key: "message", type: "string", source: "request", stateChannelKey: "messages" },
      { id: "inp-2", key: "thread_id", type: "string", source: "request" },
      { id: "inp-3", key: "demo", type: "string", source: "request" },
      { id: "inp-4", key: "id", type: "string", source: "request" },
      { id: "inp-5", key: "Authorization", type: "string", source: "request" },
    ];

    const mockNode = createMockStartNode({
      label: "START",
      inputChannels,
      stateChannels,
      suggestedParams: [
        { key: "message", type: "string", targetStateChannel: "messages" },
      ],
    });

    render(<LangGraphCanvasStartNode {...mockNode} />);

    // Header should show 1 req (only message) instead of 5 req
    expect(screen.getByText(/1 req · 0 custom/)).toBeInTheDocument();

    // Mapped variable "message" must be in the document
    expect(screen.getAllByText("message").length).toBeGreaterThanOrEqual(1);

    // Unmapped variables must NOT be displayed in the Start node request list
    expect(screen.queryByText("demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Authorization")).not.toBeInTheDocument();
    expect(screen.queryByText("id")).not.toBeInTheDocument();
  });
});
