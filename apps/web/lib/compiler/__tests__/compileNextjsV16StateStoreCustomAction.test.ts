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

  it("compiles customized default manipulators (populate with custom code, reset preserving state, and custom setter) without duplicate signatures", () => {
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
        label: "/profile",
        appSlug: "store-app",
        sections: [],
      },
    };

    const stateStoreNode: BackendNode = {
      id: "node-store-user",
      type: "state_store",
      position: { x: 200, y: -100 },
      fractionalIndex: "a2",
      data: {
        label: "UserStore",
        storeName: "User",
        scope: "global",
        storage: "memory",
        targetWebAppId: "node-webapp-main",
        fields: [
          { id: "f1", name: "userName", type: "string", defaultValue: "guest" },
          { id: "f2", name: "score", type: "number", defaultValue: 0 },
        ],
        actions: [
          // Customized populate
          {
            id: "act-populate-custom",
            name: "loadUserData",
            actionType: "populate",
            parameters: [
              { id: "p1", name: "userData", type: "object", required: true },
            ],
            code: "set((s) => ({ ...s, ...userData, lastLoaded: Date.now() }));",
            defaultManipulatorType: "populate",
          },
          // Customized reset preserving userName
          {
            id: "act-reset-custom",
            name: "clearProgress",
            actionType: "reset",
            code: "const current = get(); set({ ...initialState, userName: current.userName });",
            defaultManipulatorType: "reset",
          },
          // Customized setter for score
          {
            id: "act-setter-score",
            name: "setScore",
            targetFieldId: "f2",
            actionType: "set",
            code: "const clamped = Math.max(0, Math.min(100, Number(value) || 0)); set({ score: clamped });",
            defaultManipulatorType: "setter",
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

    const storeFile = result.files.find((f) => f.filename === "lib/stores/useUserStore.ts");
    expect(storeFile).toBeDefined();
    const code = storeFile!.content;

    // Verify customized populate name and signature
    expect(code).toContain("loadUserData: (userData: Record<string, unknown>) => void;");
    expect(code).toContain("set((s) => ({ ...s, ...userData, lastLoaded: Date.now() }));");

    // Verify customized reset name and implementation
    expect(code).toContain("clearProgress: () => void;");
    expect(code).toContain("const current = get(); set({ ...initialState, userName: current.userName });");

    // Verify customized setter implementation
    expect(code).toContain("setScore: (value: number) => void;");
    expect(code).toContain("const clamped = Math.max(0, Math.min(100, Number(value) || 0)); set({ score: clamped });");

    // Verify it is not declared as a redundant default setter
    expect(code).not.toContain("setScore: (value) => set({ score: value })");

    // Verify default setter for non-overridden field (userName) is still present
    expect(code).toContain("setUserName: (value: string) => void;");
  });

  it("respects disabledDefaultManipulators when generating store", () => {
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
        label: "/minimal",
        appSlug: "store-app",
        sections: [],
      },
    };

    const stateStoreNode: BackendNode = {
      id: "node-store-minimal",
      type: "state_store",
      position: { x: 200, y: -100 },
      fractionalIndex: "a2",
      data: {
        label: "MinimalStore",
        storeName: "Minimal",
        scope: "global",
        storage: "memory",
        targetWebAppId: "node-webapp-main",
        disabledDefaultManipulators: ["populate", "reset", "setFlag"],
        fields: [
          { id: "f1", name: "flag", type: "boolean", defaultValue: false },
          { id: "f2", name: "title", type: "string", defaultValue: "hello" },
        ],
        actions: [],
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

    const storeFile = result.files.find((f) => f.filename === "lib/stores/useMinimalStore.ts");
    expect(storeFile).toBeDefined();
    const code = storeFile!.content;

    // Disabled populate and reset should not be emitted
    expect(code).not.toContain("populate:");
    expect(code).not.toContain("reset:");

    // Disabled setFlag should not be emitted
    expect(code).not.toContain("setFlag:");

    // Non-disabled setTitle should still be emitted
    expect(code).toContain("setTitle: (value: string) => void;");
  });
});
