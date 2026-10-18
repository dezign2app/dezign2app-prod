import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EntityGroupSelect } from "../EntityGroupSelect";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Popover to avoid Radix dual-React issue in test environment
vi.mock("@workspace/ui/components/popover", () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="popover" data-state={open ? "open" : "closed"}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-header">{children}</div>
  ),
  PopoverTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-title">{children}</div>
  ),
}));

const createMockNode = (
  overrides: Partial<BackendNode> & { id: string; type: BackendNode["type"] },
): BackendNode => ({
  position: { x: 0, y: 0 },
  fractionalIndex: "a0",
  ...overrides,
  data: {
    label: "",
    ...overrides.data,
  },
});

describe("EntityGroupSelect", () => {
  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [
        createMockNode({
          id: "entity-orders",
          type: "entity",
          position: { x: 200, y: 200 },
          data: {
            label: "orders",
            tableName: "orders",
            columns: [{ name: "id", type: "string", isPrimaryKey: true }],
          },
        }),
        createMockNode({
          id: "group-auth",
          type: "group",
          position: { x: 50, y: 50 },
          width: 500,
          height: 350,
          data: {
            label: "Authentication",
            badge: "Auth",
            description: "User accounts and sessions",
            color: "#0ea5e9",
          },
        }),
      ],
      edges: [],
    });
  });

  it("renders a button to select group when unassigned in button variant", () => {
    render(<EntityGroupSelect nodeId="entity-orders" variant="button" />);

    const buttons = screen.getAllByRole("button");
    const selectBtn = buttons.find((b) => b.textContent?.includes("Select Group"));
    expect(selectBtn).toBeDefined();
  });

  it("displays the assigned group label when node has groupId or group data", () => {
    useBackendCanvasStore.setState({
      nodes: [
        createMockNode({
          id: "entity-orders",
          type: "entity",
          position: { x: 200, y: 200 },
          parentId: "group-auth",
          data: {
            label: "orders",
            groupId: "group-auth",
            group: "Authentication",
            columns: [],
          },
        }),
        createMockNode({
          id: "group-auth",
          type: "group",
          position: { x: 50, y: 50 },
          data: {
            label: "Authentication",
            badge: "Auth",
          },
        }),
      ],
    });

    render(<EntityGroupSelect nodeId="entity-orders" variant="button" />);

    const buttons = screen.getAllByRole("button");
    const authBtn = buttons.find((b) => b.textContent?.includes("Authentication"));
    expect(authBtn).toBeDefined();
  });

  it("renders sidebar variant with schema group details and button", () => {
    render(<EntityGroupSelect nodeId="entity-orders" variant="sidebar" />);

    expect(screen.getByText("Group")).toBeDefined();
    const selectBtn = screen.getByRole("button", { name: /select group/i });
    expect(selectBtn).toBeDefined();
  });

  it("assigns node to a group from the list and updates store", () => {
    render(<EntityGroupSelect nodeId="entity-orders" variant="sidebar" />);

    // Click Authentication group in popover
    const authOption = screen.getByRole("button", { name: /authentication/i });
    fireEvent.click(authOption);

    const updatedNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === "entity-orders");

    expect(updatedNode?.data.group).toBe("Authentication");
    expect(updatedNode?.data.groupId).toBe("group-auth");
  });

  it("creates a new custom group node when selecting a group name that does not exist yet", () => {
    render(<EntityGroupSelect nodeId="entity-orders" variant="button" />);

    // Type new group name
    const input = screen.getByPlaceholderText(/new group name/i);
    fireEvent.change(input, { target: { value: "Billing & Invoices" } });

    const addBtn = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addBtn);

    const store = useBackendCanvasStore.getState();
    const createdGroup = store.nodes.find(
      (n) => n.type === "group" && n.data?.label === "Billing & Invoices",
    );
    expect(createdGroup).toBeDefined();

    const updatedNode = store.nodes.find((n) => n.id === "entity-orders");
    expect(updatedNode?.data.group).toBe("Billing & Invoices");
    expect(updatedNode?.data.groupId).toBe(createdGroup?.id);
  });

  it("ensures only 1 group is selected when multiple groups exist and clears legacy parentId", () => {
    useBackendCanvasStore.setState({
      nodes: [
        createMockNode({
          id: "entity-orders",
          type: "entity",
          position: { x: 200, y: 200 },
          parentId: "group-app",
          data: {
            label: "orders",
            groupId: "group-demo",
            group: "Demo",
          },
        }),
        createMockNode({
          id: "group-app",
          type: "group",
          position: { x: 50, y: 50 },
          data: { label: "Application" },
        }),
        createMockNode({
          id: "group-demo",
          type: "group",
          position: { x: 100, y: 100 },
          data: { label: "Demo" },
        }),
      ],
    });

    render(<EntityGroupSelect nodeId="entity-orders" variant="button" />);

    const popoverContent = screen.getByTestId("popover-content");

    // In popover, Demo should be the single selected group, not Application
    const demoBtn = within(popoverContent).getByRole("button", { name: /demo/i });
    expect(demoBtn.className).toContain("bg-primary/10");

    const appBtn = within(popoverContent).getByRole("button", { name: /application/i });
    expect(appBtn.className).not.toContain("bg-primary/10");

    // Switching to Application selects only Application and clears parentId
    fireEvent.click(appBtn);

    const store = useBackendCanvasStore.getState();
    const updatedNode = store.nodes.find((n) => n.id === "entity-orders");
    expect(updatedNode?.data.groupId).toBe("group-app");
    expect(updatedNode?.data.group).toBe("Application");
    expect(updatedNode?.parentId).toBeUndefined();
    expect(updatedNode?.data.parentId).toBeUndefined();
  });
});

