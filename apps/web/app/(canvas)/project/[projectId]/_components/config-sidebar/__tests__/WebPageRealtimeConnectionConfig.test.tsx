import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebPageRealtimeConnectionConfig } from "../WebPageRealtimeConnectionConfig";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { BackendNode, BackendEdge } from "@workspace/canvas";

interface MockAccordionProps {
  children?: React.ReactNode;
}

vi.mock("@workspace/ui/components/accordion", () => ({
  Accordion: ({ children }: MockAccordionProps) => <div data-testid="mock-accordion">{children}</div>,
  AccordionItem: ({ children }: MockAccordionProps) => <div data-testid="mock-accordion-item">{children}</div>,
  AccordionTrigger: ({ children }: MockAccordionProps) => <button type="button">{children}</button>,
  AccordionContent: ({ children }: MockAccordionProps) => <div>{children}</div>,
}));

import type { ActionFlowEditorProps } from "../web-page-event-config/action-flow/types";
import type { ActionSimulatorProps } from "../web-page-event-config/action-flow/ActionSimulator";
import type { RealtimeConnectionHeaderProps } from "../web-page-realtime-config";

vi.mock("../web-page-event-config", () => ({
  ActionFlowEditor: (props: ActionFlowEditorProps) => (
    <div data-testid="mock-action-flow-editor">
      ActionFlowEditor: {props.item?.name} - {props.item?.actionSteps?.length ?? 0} steps
    </div>
  ),
  ActionSimulator: (props: ActionSimulatorProps) => (
    <div data-testid="mock-action-simulator">
      ActionSimulator: {props.item?.name}
    </div>
  ),
}));

vi.mock("../web-page-realtime-config", () => ({
  RealtimeConnectionHeader: (props: RealtimeConnectionHeaderProps) => (
    <div data-testid="mock-realtime-header">{props.conn?.eventName}</div>
  ),
  RealtimeProtocolSection: () => <div data-testid="mock-protocol-section" />,
  WebRtcCapabilitiesSection: () => <div data-testid="mock-webrtc-section" />,
  RealtimeStateStoreSection: () => <div data-testid="mock-statestore-section" />,
  useDerivedRealtimeInfo: () => null,
}));

describe("WebPageRealtimeConnectionConfig with action steps", () => {
  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [],
      edges: [],
      endpoints: [],
      events: [],
    });
  });

  it("renders Pipeline Steps (ActionFlowEditor) and ActionSimulator for realtime connection", () => {
    const dummyWebPageNode: BackendNode = {
      id: "web-node-1",
      type: "webPage",
      fractionalIndex: "a0",
      position: { x: 0, y: 0 },
      data: {
        label: "Dashboard",
        realtimeConnections: [
          {
            id: "rtc-1",
            protocol: "SSE",
            eventName: "order.created",
            actionSteps: [
              {
                id: "step-1",
                order: 1,
                type: "notification",
                name: "Notify Order",
                notifyMessage: "New order received!",
              },
            ],
          },
        ],
      },
    };

    useBackendCanvasStore.setState({
      nodes: [dummyWebPageNode],
      edges: [],
    });

    render(<WebPageRealtimeConnectionConfig id="rtc-1" nodeId="web-node-1" />);

    expect(screen.getByText("Pipeline Steps")).toBeDefined();
    expect(screen.getByText("1 step")).toBeDefined();
    expect(screen.getByTestId("mock-action-flow-editor")).toBeDefined();
    expect(
      screen.getByText("ActionFlowEditor: order.created - 1 steps"),
    ).toBeDefined();
    expect(screen.getByTestId("mock-action-simulator")).toBeDefined();
  });
});
