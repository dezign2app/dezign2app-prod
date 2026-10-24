import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@workspace/ui/components/popover", () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@workspace/ui/components/select", () => ({
  Select: ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (val: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value?: string;
  }) => <div data-value={value}>{children}</div>,
}));

vi.mock("../web-page-event-config/action-flow/ActionFlowCombobox", () => ({
  ActionFlowCombobox: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="mock-combobox"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import { IncomingRealtimePayloadCard } from "../web-page-event-config/action-flow/IncomingRealtimePayloadCard";
import { RealtimeSubscriptionMappingSection } from "../web-page-realtime-config/RealtimeSubscriptionMappingSection";
import type { BackendNode, RealtimeConnection } from "@workspace/canvas";

describe("IncomingRealtimePayloadCard", () => {
  it("renders live payload card with detected fields and toggles sample JSON preview", () => {
    const mockPaths = [
      { path: "message", type: "string", description: "Message body" },
      { path: "id", type: "string", description: "Identifier" },
      { path: "sender.name", type: "string", description: "Sender name" },
    ];

    render(
      <IncomingRealtimePayloadCard
        eventName="send-message/:id"
        protocol="SSE"
        sourceServiceLabel="Conversations"
        sourceItemName="send-message/:id"
        incomingPaths={mockPaths}
      />
    );

    // Verify header and stream metadata badges
    expect(screen.getByText("Incoming Real-Time Payload")).toBeDefined();
    expect(screen.getByText("send-message/:id")).toBeDefined();
    expect(screen.getByText("SSE")).toBeDefined();
    expect(screen.getByText(/Conversations/i)).toBeDefined();

    // Verify detected schema field pills
    expect(screen.getByText("message")).toBeDefined();
    expect(screen.getByText("id")).toBeDefined();
    expect(screen.getByText("sender.name")).toBeDefined();

    // Toggle sample JSON preview
    const sampleJsonBtn = screen.getByText(/Sample JSON Structure/i);
    expect(sampleJsonBtn).toBeDefined();
    fireEvent.click(sampleJsonBtn);

    // Verify JSON preview is visible
    expect(screen.getByText(/Hide/i)).toBeDefined();
    expect(screen.getByText(/Hello from realtime stream/i)).toBeDefined();
  });
});

describe("RealtimeSubscriptionMappingSection", () => {
  it("detects route parameters and allows configuring subscription bindings", () => {
    const mockConn: RealtimeConnection = {
      id: "rtc-test-1",
      protocol: "SSE",
      eventName: "send-message/:id",
      subscriptionBindings: [
        {
          id: "sub-1",
          slot: "path_param",
          targetField: "id",
          source: { kind: "route_param", paramName: "id" },
        },
      ],
    };

    const mockPageNode: BackendNode = {
      id: "page-1",
      type: "webPage",
      fractionalIndex: "a0",
      position: { x: 0, y: 0 },
      data: {
        label: "Dashboard",
        pathParams: [{ name: "id", type: "string", id: "234", required: false }],
        queryParams: [{ name: "filter", type: "string", id: "235", required: false   }],
      },
    };

    const onUpdate = vi.fn();

    render(
      <RealtimeSubscriptionMappingSection
        conn={mockConn}
        pageNode={mockPageNode}
        allNodes={[mockPageNode]}
        onUpdate={onUpdate}
      />
    );

    // Verify auto-map button and path parameters section
    expect(screen.getByText(/Auto-map/i)).toBeDefined();
    expect(screen.getByText("Path Parameters")).toBeDefined();
    expect(screen.getByText(":id")).toBeDefined();

    // Verify generated subscription code preview
    expect(screen.getByText("Generated Subscription Code Preview")).toBeDefined();
    expect(screen.getByText(/EventSource/i)).toBeDefined();
  });
});
