import { describe, it, expect } from "vitest";
import { generateCompiledStoreCallSnippet } from "../StoreCallPreviewCard";

describe("generateCompiledStoreCallSnippet", () => {
  it("compiles explicit field-by-field parameter mappings for populate()", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "ConversationStore",
      actionName: "populate",
      actionType: "populate",
      parameterMappings: {
        conversations: "data.items",
        totalCount: "data.total",
      },
      sourceKind: "response",
    });

    expect(snippet).toContain("useConversationStore.getState().populate({");
    expect(snippet).toContain("conversations: response?.data?.items,");
    expect(snippet).toContain("totalCount: response?.data?.total,");
    expect(snippet).toContain("});");
  });

  it("compiles realtime message mappings for populate()", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "ChatStore",
      actionName: "populate",
      actionType: "populate",
      parameterMappings: {
        messages: "items",
      },
      sourceKind: "message",
    });

    expect(snippet).toContain("useChatStore.getState().populate({");
    expect(snippet).toContain("messages: message?.items,");
    expect(snippet).toContain("});");
  });

  it("compiles field setter with valuePath", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "UserStore",
      actionName: "setProfile",
      actionType: "set",
      targetFieldName: "profile",
      valuePath: "data.user",
      sourceKind: "response",
    });

    expect(snippet).toBe("useUserStore.getState().setProfile(response?.data?.user);");
  });

  it("compiles field setter with static value", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "AuthStore",
      actionName: "setIsLoggedIn",
      actionType: "set",
      updateSource: "static",
      customValue: "true",
    });

    expect(snippet).toBe("useAuthStore.getState().setIsLoggedIn(true);");
  });

  it("compiles direct trigger with no arguments", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "CounterStore",
      actionName: "increment",
      actionType: "increment",
      updateSource: "direct",
    });

    expect(snippet).toBe("useCounterStore.getState().increment();");
  });

  it("compiles reset manipulator", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "CartStore",
      actionName: "reset",
      actionType: "reset",
    });

    expect(snippet).toBe("useCartStore.getState().reset();");
  });

  it("compiles custom action with multi-parameter mappings", () => {
    const snippet = generateCompiledStoreCallSnippet({
      storeName: "ChatStore",
      actionName: "sendMessage",
      actionType: "custom",
      parameterMappings: {
        channelId: "data.channelId",
        content: "data.text",
      },
      sourceKind: "payload",
    });

    expect(snippet).toBe("useChatStore.getState().sendMessage(payload?.data?.channelId, payload?.data?.text);");
  });
});
