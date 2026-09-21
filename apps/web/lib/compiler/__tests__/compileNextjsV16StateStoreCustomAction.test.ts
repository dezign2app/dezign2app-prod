import { describe, it, expect } from "vitest";
import { BackendNode } from "@/types/canvas";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";

describe("compileNextjsV16StateStoreCustomAction", () => {
  it("compiles custom action with parameters and custom code using (set, get)", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-main",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "StoreApp",
        appSlug: "store-app",
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-main",
      type: "webPage",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/cart",
        appSlug: "store-app",
        sections: [],
      },
    };

    const stateStoreNode: BackendNode = {
      id: "node-store-cart",
      type: "state_store",
      position: { x: 200, y: -100 },
      fractionalIndex: "a2",
      data: {
        label: "CartStore",
        storeName: "Cart",
        scope: "global",
        storage: "memory",
        targetWebAppId: "node-webapp-main",
        fields: [
          { id: "f1", name: "items", type: "array", defaultValue: [] },
          { id: "f2", name: "total", type: "number", defaultValue: 0 },
        ],
        actions: [
          {
            id: "act-custom-add",
            name: "addItem",
            actionType: "custom",
            parameters: [
              { id: "p1", name: "item", type: "object", required: true },
              { id: "p2", name: "qty", type: "number", required: false },
            ],
            code: `const currentItems = (get().items || []) as Array<Record<string, unknown>>;\nconst quantity = qty || 1;\nset({ items: [...currentItems, { ...item, qty: quantity }] });`,
          },
        ],
      },
    };

    const result = compileNextjsV16WebClient(
      [webPageNode],
      [],
      [],
      [webAppNode, webPageNode, stateStoreNode],
      [],
      "StoreApp",
      [],
      "store-app",
      webAppNode,
    );

    const storeFile = result.files.find((f) => f.filename === "lib/stores/useCartStore.ts");
    expect(storeFile).toBeDefined();
    const code = storeFile!.content;

    // Verify Zustand creation uses (set, get)
    expect(code).toContain("create<CartStoreState>((set, get) => ({");
    // Verify typed signature with parameters
    expect(code).toContain("addItem: (item: Record<string, unknown>, qty: number | undefined) => void;");
    // Verify custom code implementation body
    expect(code).toContain("const currentItems = (get().items || []) as Array<Record<string, unknown>>;");
    expect(code).toContain("set({ items: [...currentItems, { ...item, qty: quantity }] });");
  });
});
