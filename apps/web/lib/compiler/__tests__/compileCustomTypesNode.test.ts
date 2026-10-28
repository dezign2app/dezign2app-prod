import { describe, it, expect } from "vitest";
import { BackendNode } from "@/types/canvas";
import { generateTypesPackage } from "../generators/typesGenerator";

describe("compileCustomTypesNode - generateTypesPackage", () => {
  it("compiles structured custom types into src/custom.ts and exports in index.ts", () => {
    const typesNode: BackendNode = {
      id: "types-node-1",
      type: "types",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Domain Types",
        definitionMode: "visual",
        types: [
          {
            id: "t1",
            name: "UserProfile",
            kind: "interface",
            description: "User profile details",
            fields: [
              { id: "f1", name: "id", type: "string", required: true },
              { id: "f2", name: "email", type: "string", required: true },
              { id: "f3", name: "age", type: "number", required: false },
              { id: "f4", name: "tags", type: "string", isArray: true },
            ],
          },
          {
            id: "t2",
            name: "OrderStatus",
            kind: "enum",
            enumValues: ["PENDING", "PROCESSING", "COMPLETED"],
          },
          {
            id: "t3",
            name: "UserRole",
            kind: "type",
            typeAliasValue: "'admin' | 'customer'",
          },
        ],
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);

    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("export interface UserProfile");
    expect(customFile?.content).toContain("id: string;");
    expect(customFile?.content).toContain("email: string;");
    expect(customFile?.content).toContain("age?: number;");
    expect(customFile?.content).toContain("tags: string[];");
    expect(customFile?.content).toContain("export enum OrderStatus");
    expect(customFile?.content).toContain('PENDING = "PENDING"');
    expect(customFile?.content).toContain("export type UserRole = 'admin' | 'customer';");

    const indexFile = files.find((f) => f.filename === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('export * from "./custom";');
  });

  it("compiles raw TypeScript definitions into src/custom.ts", () => {
    const rawCode = `export interface CartItem {\n  productId: string;\n  quantity: number;\n}\n`;
    const typesNode: BackendNode = {
      id: "types-node-raw",
      type: "types",
      position: { x: 200, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Raw Cart Types",
        definitionMode: "raw",
        rawTypeScript: rawCode,
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);
    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("export interface CartItem");
    expect(customFile?.content).toContain("quantity: number;");
  });

  it("safely sanitizes truncated types ending with ellipsis without breaking syntax", () => {
    const typesNode: BackendNode = {
      id: "types-node-truncated",
      type: "types",
      position: { x: 300, y: 300 },
      fractionalIndex: "a2",
      data: {
        label: "Extracted Types",
        definitionMode: "visual",
        types: [
          {
            id: "t-truncated-1",
            name: "ReactFlowProps",
            kind: "interface",
            fields: [
              {
                id: "f1",
                name: "onReconnectEnd",
                type: "((event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => void) | ...",
                required: false,
              },
              {
                id: "f2",
                name: "truncatedPrimitive",
                type: "string | ...",
                required: true,
              },
            ],
          },
        ],
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);
    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("onReconnectEnd?: (...args: any[]) => any;");
    expect(customFile?.content).toContain("truncatedPrimitive: any;");
  });

  it("compiles custom function types into reusable type signatures", () => {
    const typesNode: BackendNode = {
      id: "types-node-functions",
      type: "types",
      position: { x: 400, y: 400 },
      fractionalIndex: "a3",
      data: {
        label: "Function Signatures",
        definitionMode: "visual",
        types: [
          {
            id: "t-fn-1",
            name: "CalculateTotal",
            kind: "function",
            description: "Calculates cart total with optional discount",
            fields: [
              { id: "p1", name: "items", type: "string[]", required: true },
              { id: "p2", name: "discount", type: "number", required: false },
            ],
            returnType: "number",
          },
          {
            id: "t-fn-2",
            name: "FetchUserCallback",
            kind: "function",
            fields: [
              { id: "p1", name: "userId", type: "string", required: true },
            ],
            returnType: "Promise<UserProfile>",
          },
        ],
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);
    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("export type CalculateTotal = (items: string[], discount?: number) => number;");
    expect(customFile?.content).toContain("export type FetchUserCallback = (userId: string) => Promise<UserProfile>;");
  });

  it("compiles complex union type aliases and properly wraps union array fields in parentheses", () => {
    const typesNode: BackendNode = {
      id: "types-node-unions",
      type: "types",
      position: { x: 500, y: 500 },
      fractionalIndex: "a4",
      data: {
        label: "Complex Union Types",
        definitionMode: "visual",
        types: [
          {
            id: "t-union-1",
            name: "ApiResponse",
            kind: "type",
            description: "Discriminated or complex union",
            typeAliasValue: "SuccessPayload | ErrorPayload | null",
          },
          {
            id: "t-intf-with-union",
            name: "BatchProcessingJob",
            kind: "interface",
            fields: [
              {
                id: "f1",
                name: "results",
                type: "SuccessPayload | ErrorPayload",
                isArray: true,
                required: true,
              },
              {
                id: "f2",
                name: "fallback",
                type: "string | null",
                isArray: false,
                required: false,
              },
            ],
          },
        ],
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);
    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("export type ApiResponse = SuccessPayload | ErrorPayload | null;");
    expect(customFile?.content).toContain("results: (SuccessPayload | ErrorPayload)[];");
    expect(customFile?.content).toContain("fallback?: string | null;");
  });

  it("compiles top-level type aliases from unnamed property rows joined by union", () => {
    const typesNode: BackendNode = {
      id: "types-node-unnamed-rows",
      type: "types",
      position: { x: 600, y: 600 },
      fractionalIndex: "a5",
      data: {
        label: "Composed Type Aliases",
        definitionMode: "visual",
        types: [
          {
            id: "t-row-union",
            name: "CombinedStatus",
            kind: "type",
            fields: [
              { id: "r1", name: "", type: "ActiveStatus", required: true },
              { id: "r2", name: "", type: "InactiveStatus", required: true },
            ],
          },
        ],
      },
    };

    const files = generateTypesPackage([typesNode], [], [], []);
    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).toContain("export type CombinedStatus = ActiveStatus | InactiveStatus;");
  });
});
