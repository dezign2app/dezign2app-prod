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
});
