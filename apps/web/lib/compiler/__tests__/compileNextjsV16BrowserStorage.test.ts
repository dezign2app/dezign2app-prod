import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import { browserStorageNodeDataSchema } from "@workspace/canvas/schemas";
import { createGraphNodeData } from "@/app/(canvas)/project/[projectId]/_components/GraphView/utils";
import { createDefaultFrontendStep } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/web-page-event-config/action-flow/frontendStepFactory";

describe("compileNextjsV16BrowserStorage", () => {
  it("validates BrowserStorageNode schema and initializes default data correctly", () => {
    const rawData = createGraphNodeData("browser_storage", "SessionStore", []);
    expect(rawData.label).toBe("SessionStore");
    expect(rawData.storageEngine).toBe("localStorage");
    expect(rawData.keys).toHaveLength(1);
    expect(rawData.keys?.[0]?.name).toBe("auth_token");

    const parsed = browserStorageNodeDataSchema.safeParse(rawData);
    expect(parsed.success).toBe(true);
  });

  it("creates default frontend action step for browser_storage", () => {
    const step = createDefaultFrontendStep("browser_storage", 1);
    expect(step.type).toBe("browser_storage");
    expect(step.storageEngine).toBe("localStorage");
    expect(step.storageOperation).toBe("set");
    expect(step.storageKey).toBe("auth_token");
    expect(step.storageValueSource).toEqual({ kind: "literal", value: "" });
  });

  it("compiles BrowserStorageNode into lib/storage/browserStorage.ts with safe helpers and React hook", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-main",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "StorageApp",
        appSlug: "storage-app",
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-home",
      type: "webPage",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/dashboard",
        appSlug: "storage-app",
        sections: [],
      },
    };

    const browserStorageNode: BackendNode = {
      id: "node-browser-storage-1",
      type: "browser_storage",
      position: { x: 200, y: -100 },
      fractionalIndex: "a2",
      data: {
        label: "AppStorage",
        storageName: "AppStorage",
        storageEngine: "localStorage",
        namespace: "app:",
        keys: [
          {
            id: "k1",
            name: "auth_token",
            type: "string",
            defaultValue: "",
            description: "Access token",
          },
          {
            id: "k2",
            name: "theme",
            type: "string",
            defaultValue: "dark",
            description: "Theme mode",
          },
        ],
      },
    };

    const edge: BackendEdge = {
      id: "edge-storage-to-page",
      source: browserStorageNode.id,
      target: webPageNode.id,
      type: "connection",
      fractionalIndex: "e0",
    };

    const allNodes = [webAppNode, webPageNode, browserStorageNode];
    const result = compileNextjsV16WebClient(
      [webPageNode],
      [],
      [],
      allNodes,
      [edge],
      "StorageApp",
      [],
      "storage-app",
      webAppNode,
    );

    const storageFile = result.files.find(
      (f) => f.filename === "lib/storage/browserStorage.ts",
    );
    expect(storageFile).toBeDefined();
    expect(storageFile?.content).toContain("export function getBrowserStorageItem");
    expect(storageFile?.content).toContain("export function setBrowserStorageItem");
    expect(storageFile?.content).toContain("export function removeBrowserStorageItem");
    expect(storageFile?.content).toContain("export function clearBrowserStorage");
    expect(storageFile?.content).toContain("export function toggleBrowserStorageItem");
    expect(storageFile?.content).toContain("export function appendBrowserStorageItem");
    expect(storageFile?.content).toContain("export function useBrowserStorage");
    expect(storageFile?.content).toContain('typeof window === "undefined"');
  });

  it("compiles browserStorage.ts when a web page section action contains a browser_storage action step", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-main",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "StorageApp",
        appSlug: "storage-app",
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-login",
      type: "webPage",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/login",
        appSlug: "storage-app",
        sections: [
          {
            id: "sec-login",
            name: "LoginForm",
            actions: [
              {
                id: "act-login-submit",
                name: "handleLogin",
                actionSteps: [
                  {
                    id: "step-save-token",
                    order: 1,
                    type: "browser_storage",
                    storageEngine: "localStorage",
                    storageOperation: "set",
                    storageKey: "auth_token",
                    storageValueSource: { kind: "literal", value: "test-jwt-token" },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const allNodes = [webAppNode, webPageNode];
    const result = compileNextjsV16WebClient(
      [webPageNode],
      [],
      [],
      allNodes,
      [],
      "StorageApp",
      [],
      "storage-app",
      webAppNode,
    );

    const storageFile = result.files.find(
      (f) => f.filename === "lib/storage/browserStorage.ts",
    );
    expect(storageFile).toBeDefined();
    expect(storageFile?.content).toContain("export function setBrowserStorageItem");
  });
});

