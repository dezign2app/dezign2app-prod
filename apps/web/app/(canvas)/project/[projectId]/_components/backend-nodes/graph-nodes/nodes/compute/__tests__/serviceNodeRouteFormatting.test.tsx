import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { formatEndpointRoute, sanitizeEndpointRoute } from "@workspace/canvas";
import { EndpointRow } from "../../../common/EndpointList";
import { Endpoint } from "@/types/canvas";
import { EndpointWithNode } from "@/lib/stores/backendCanvas/types";
import { createEndpointSlice } from "@/lib/stores/backendCanvas/slices/endpointSlice";
import { EndpointConfig } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/EndpointConfig";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "proj-1" }),
}));

// Mock EndpointConfig sub-components
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/hooks/useCallerWebPageZone", () => ({
  useCallerWebPageZone: () => ({ isProtected: false, zoneName: "" }),
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/AuthAwarenessBanner", () => ({
  AuthAwarenessBanner: () => null,
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/RequestBodyEditor", () => ({
  RequestBodyEditor: () => null,
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/NestedResponseSchemaEditor", () => ({
  NestedResponseSchemaEditor: () => null,
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/endpoint-testing/EndpointTestCasesSection", () => ({
  EndpointTestCasesSection: () => null,
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/config-sidebar/PipelineStepEditor", () => ({
  PipelineStepEditor: () => null,
}));
vi.mock("@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/Editors", () => ({
  ParameterEditor: () => null,
}));

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  useUpdateNodeInternals: () => vi.fn(),
}));

// Mock @workspace/ui components
vi.mock("@workspace/ui/components/select", () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <div>{placeholder}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value?: string }) => <div data-value={value}>{children}</div>,
}));

vi.mock("@workspace/ui/components/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

const mockUpdateEndpoint = vi.fn();
const mockEndpoints: EndpointWithNode[] = [
  { id: "ep-1", name: "send msg", type: "GET", nodeId: "srv-1" },
];

// Mock zustand canvas store
vi.mock("@/lib/stores/backendCanvasStore", () => ({
  useBackendCanvasStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        edges: [],
        nodes: [{ id: "srv-1", type: "service", data: {} }],
        endpoints: mockEndpoints,
        events: [],
        setActiveConfigItem: vi.fn(),
        updateEndpoint: mockUpdateEndpoint,
        deleteEndpoint: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    {
      getState: () => ({
        edges: [],
        nodes: [{ id: "srv-1", type: "service", data: {} }],
        endpoints: mockEndpoints,
        events: [],
        setActiveConfigItem: vi.fn(),
        updateEndpoint: mockUpdateEndpoint,
        deleteEndpoint: vi.fn(),
      }),
    },
  ),
}));

describe("Route space-to-hyphen transformation", () => {
  describe("formatEndpointRoute & sanitizeEndpointRoute utilities", () => {
    it("transforms 'send msg' to 'send-msg'", () => {
      expect(formatEndpointRoute("send msg")).toBe("send-msg");
    });

    it("transforms '/send msg' to '/send-msg'", () => {
      expect(formatEndpointRoute("/send msg")).toBe("/send-msg");
    });

    it("collapses multiple consecutive spaces to a single hyphen", () => {
      expect(formatEndpointRoute("send   msg")).toBe("send-msg");
      expect(formatEndpointRoute("/api/v1/send   order")).toBe("/api/v1/send-order");
    });

    it("sanitizes by trimming and transforming internal spaces", () => {
      expect(sanitizeEndpointRoute("  send msg  ")).toBe("send-msg");
      expect(sanitizeEndpointRoute("  /users list  ")).toBe("/users-list");
      expect(sanitizeEndpointRoute("")).toBe("");
    });
  });

  describe("EndpointSlice state sanitization", () => {
    it("sanitizes route on addEndpoint", () => {
      let state: any = {
        endpoints: [],
        pendingEndpointUpserts: [],
        pendingEndpointRemovals: [],
        pushHistorySnapshot: vi.fn(),
      };
      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
      };
      const get = () => state;

      const slice = createEndpointSlice(set, get);
      slice.addEndpoint("node-1", {
        id: "ep-1",
        name: "send msg",
        type: "POST",
      } as Endpoint);

      expect(state.endpoints[0].name).toBe("send-msg");
    });

    it("sanitizes route on updateEndpoint", () => {
      let state: any = {
        endpoints: [{ id: "ep-1", name: "/", type: "GET", nodeId: "node-1" }],
        edges: [],
        events: [],
        pendingEventRemovals: [],
        pendingEndpointUpserts: [],
        pendingEdgeUpserts: [],
        pendingEdgeRemovals: [],
        pushHistorySnapshot: vi.fn(),
      };
      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
      };
      const get = () => state;

      const slice = createEndpointSlice(set, get);
      slice.updateEndpoint("ep-1", { name: "send new msg" });

      expect(state.endpoints[0].name).toBe("send-new-msg");
    });
  });

  describe("EndpointRow on ServiceNode", () => {
    it("transforms spaces into hyphens in real-time when typing in the route input", () => {
      const endpoint: Endpoint = {
        id: "ep-1",
        name: "",
        type: "GET",
      };

      const setEditingName = vi.fn();
      const handleUpdate = vi.fn();

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={true}
          setEditingId={vi.fn()}
          setEditingName={setEditingName}
          setEditingType={vi.fn()}
          handleUpdate={handleUpdate}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="GET"
        />,
      );

      const input = screen.getByPlaceholderText(/e\.g\. \/users/i);
      fireEvent.change(input, { target: { value: "send msg" } });
      fireEvent.blur(input);

      // setEditingName should be called with "send-msg", NOT "send msg"
      expect(setEditingName).toHaveBeenCalledWith("send-msg");
    });

    it("saves sanitized route on Enter key press", () => {
      const endpoint: Endpoint = {
        id: "ep-1",
        name: "",
        type: "GET",
      };

      const handleUpdate = vi.fn();
      const setEditingId = vi.fn();

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={true}
          setEditingId={setEditingId}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={handleUpdate}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName="send msg"
          editingType="POST"
        />,
      );

      const input = screen.getByPlaceholderText(/e\.g\. \/users/i);
      fireEvent.keyDown(input, { key: "Enter" });

      expect(handleUpdate).toHaveBeenCalledWith("ep-1", "send-msg", "POST");
      expect(setEditingId).toHaveBeenCalledWith(null);
    });

    it("displays an existing endpoint formatted without spaces", () => {
      const endpoint: Endpoint = {
        id: "ep-1",
        name: "send msg",
        type: "POST",
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("send-msg")).toBeDefined();
    });

    it("displays an endpoint reflecting path params on EndpointRow", () => {
      const endpoint: Endpoint = {
        id: "ep-2",
        name: "send-message",
        type: "POST",
        pathParams: [{ id: "p1", name: "hello", type: "string", required: true }],
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("send-message/:hello")).toBeDefined();
    });

    it("displays query params preview on EndpointRow", () => {
      const endpoint: Endpoint = {
        id: "ep-3",
        name: "send-message",
        type: "POST",
        queryParams: [{ id: "q1", name: "sort", type: "string", required: false }],
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("?sort=")).toBeDefined();
    });

    it("displays query params with default values (?key=defaultvalue&key2=&key3=value) on EndpointRow", () => {
      const endpoint: Endpoint = {
        id: "ep-4",
        name: "send-message",
        type: "POST",
        queryParams: [
          { id: "q1", name: "key", defaultValue: "defaultvalue", type: "string", required: false },
          { id: "q2", name: "key2", type: "string", required: false },
          { id: "q3", name: "key3", defaultValue: "value", type: "string", required: false },
        ],
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("?key=defaultvalue&key2=&key3=value")).toBeDefined();
    });

    it("deduplicates duplicate path params (:id/:id) on EndpointRow", () => {
      const endpoint: Endpoint = {
        id: "ep-5",
        name: "send-message/:id/:id",
        type: "POST",
        pathParams: [
          { id: "p1", name: "id", type: "string", required: true },
          { id: "p2", name: "id", type: "string", required: true },
        ],
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("send-message/:id")).toBeDefined();
    });

    it("deduplicates duplicate query params and excludes query params matching path params", () => {
      const endpoint: Endpoint = {
        id: "ep-6",
        name: "send-message",
        type: "POST",
        pathParams: [{ id: "p1", name: "id", type: "string", required: true }],
        queryParams: [
          { id: "q1", name: "id", defaultValue: "123", type: "string", required: false },
          { id: "q2", name: "hello", defaultValue: "sub", type: "string", required: false },
          { id: "q3", name: "hello", defaultValue: "ignored", type: "string", required: false },
        ],
      };

      render(
        <EndpointRow
          nodeId="srv-1"
          item={endpoint}
          isEditing={false}
          setEditingId={vi.fn()}
          setEditingName={vi.fn()}
          setEditingType={vi.fn()}
          handleUpdate={vi.fn()}
          handleDelete={vi.fn()}
          handleUpdateItem={vi.fn()}
          editingName=""
          editingType="POST"
        />,
      );

      expect(screen.getByText("send-message/:id")).toBeDefined();
      expect(screen.getByText("?hello=sub")).toBeDefined();
    });
  });

  describe("EndpointConfig sidebar", () => {
    it("initializes route path input with hyphens for existing endpoint with spaces", () => {
      render(<EndpointConfig id="ep-1" nodeId="srv-1" />);

      const input = screen.getByPlaceholderText("/v1/resource");
      expect(input).toBeInstanceOf(HTMLInputElement);
      if (input instanceof HTMLInputElement) {
        expect(input.value).toBe("send-msg");
      }
    });

    it("transforms spaces to hyphens in real-time when editing route in EndpointConfig", () => {
      mockUpdateEndpoint.mockClear();
      render(<EndpointConfig id="ep-1" nodeId="srv-1" />);

      const input = screen.getByPlaceholderText("/v1/resource");
      expect(input).toBeInstanceOf(HTMLInputElement);
      if (input instanceof HTMLInputElement) {
        fireEvent.change(input, { target: { value: "order checkout" } });
        expect(input.value).toBe("order-checkout");
        fireEvent.blur(input);
        expect(mockUpdateEndpoint).toHaveBeenCalledWith("ep-1", { name: "order-checkout" });
      }
    });

    it("auto-syncs route path when endpoint has path params", () => {
      mockUpdateEndpoint.mockClear();
      const newEp: EndpointWithNode = {
        id: "ep-with-params",
        name: "send-message",
        type: "POST",
        nodeId: "srv-1",
        pathParams: [{ id: "p1", name: "hello", type: "string", required: true }],
      };
      mockEndpoints.push(newEp);

      render(<EndpointConfig id="ep-with-params" nodeId="srv-1" />);

      expect(mockUpdateEndpoint).toHaveBeenCalledWith("ep-with-params", {
        name: "send-message/:hello",
      });
    });
  });
});
