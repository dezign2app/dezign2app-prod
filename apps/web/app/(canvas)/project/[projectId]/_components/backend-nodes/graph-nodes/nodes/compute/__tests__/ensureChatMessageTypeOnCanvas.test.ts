import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  ensureChatMessageTypeOnCanvas,
  CHAT_MESSAGE_CUSTOM_TYPE,
} from "../TypesNode";

describe("ensureChatMessageTypeOnCanvas", () => {
  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [],
      edges: [],
    });
  });

  it("creates a new App Types node with ChatMessage when none exists", () => {
    const { typesNodeId, typeItem } = ensureChatMessageTypeOnCanvas({ x: 200, y: 150 });

    expect(typeItem).toEqual(CHAT_MESSAGE_CUSTOM_TYPE);
    expect(typesNodeId).toMatch(/^types-app-/);

    const nodes = useBackendCanvasStore.getState().nodes;
    const createdNode = nodes.find((n) => n.id === typesNodeId);
    expect(createdNode).toBeDefined();
    expect(createdNode?.data?.label).toBe("App Types");
    expect(createdNode?.data?.types).toContainEqual(CHAT_MESSAGE_CUSTOM_TYPE);
  });

  it("reuses existing general App Types node and adds ChatMessage", () => {
    useBackendCanvasStore.setState({
      nodes: [
        {
          id: "types-general-1",
          type: "types",
          position: { x: 100, y: 100 },
          data: {
            label: "App Types",
            scope: "global",
            types: [],
          },
        } as any,
      ],
      edges: [],
    });

    const { typesNodeId, typeItem } = ensureChatMessageTypeOnCanvas();

    expect(typesNodeId).toBe("types-general-1");
    expect(typeItem).toEqual(CHAT_MESSAGE_CUSTOM_TYPE);

    const node = useBackendCanvasStore.getState().nodes.find((n) => n.id === "types-general-1");
    expect(node?.data?.types).toContainEqual(CHAT_MESSAGE_CUSTOM_TYPE);
  });

  it("returns existing ChatMessage without duplicating if already present", () => {
    useBackendCanvasStore.setState({
      nodes: [
        {
          id: "types-general-1",
          type: "types",
          position: { x: 100, y: 100 },
          data: {
            label: "App Types",
            scope: "global",
            types: [CHAT_MESSAGE_CUSTOM_TYPE],
          },
        } as any,
      ],
      edges: [],
    });

    const { typesNodeId, typeItem } = ensureChatMessageTypeOnCanvas();

    expect(typesNodeId).toBe("types-general-1");
    expect(typeItem.name).toBe("ChatMessage");

    const node = useBackendCanvasStore.getState().nodes.find((n) => n.id === "types-general-1");
    expect((node?.data?.types || []).filter((t: any) => t.name === "ChatMessage")).toHaveLength(1);
  });

  it("upgrades existing ChatMessage role field from string to enum with user, assistant, and system", () => {
    useBackendCanvasStore.setState({
      nodes: [
        {
          id: "types-general-1",
          type: "types",
          position: { x: 100, y: 100 },
          data: {
            label: "App Types",
            scope: "global",
            types: [
              {
                id: "type-chat-message",
                name: "ChatMessage",
                kind: "interface",
                fields: [
                  { id: "f-chat-id", name: "id", type: "string" },
                  { id: "f-chat-role", name: "role", type: "string" },
                  { id: "f-chat-content", name: "content", type: "string" },
                ],
              },
            ],
          },
        } as any,
      ],
      edges: [],
    });

    const { typeItem } = ensureChatMessageTypeOnCanvas();
    const roleField = typeItem.fields?.find((f) => f.name === "role");
    expect(roleField?.type).toBe("enum");
    expect(roleField?.enumValues).toEqual(["user", "assistant", "system"]);
  });
});

