import { describe, it, expect } from "vitest";
import { BackendNode } from "@/types/canvas";
import { generateTypesPackage } from "../generators/typesGenerator";
import { generateZustandStores } from "../webClients/nextjs/v16/storeGenerators";

describe("compileTypesDisambiguation", () => {
  it("disambiguates clashing entity aliases and custom type names in generateTypesPackage", () => {
    const dbEntityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string" },
        ],
      },
    };

    const messagesEntityNode: BackendNode = {
      id: "entity-messages",
      type: "entity",
      position: { x: 0, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "messages",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "content", type: "string" },
        ],
      },
    };

    const typesNode: BackendNode = {
      id: "types-custom",
      type: "types",
      position: { x: 100, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Custom Types",
        definitionMode: "visual",
        types: [
          {
            id: "t-msg",
            name: "Message",
            kind: "type",
            fields: [
              { id: "f1", name: "id", type: "string", required: true },
              { id: "f2", name: "sender", type: "string", required: true },
              { id: "f3", name: "content", type: "string", required: true },
            ],
          },
          {
            id: "t-conv",
            name: "Conversation",
            kind: "type",
            fields: [
              { id: "f1", name: "id", type: "string", required: true },
              { id: "f2", name: "messages", type: "Message[]", required: true },
            ],
          },
        ],
      },
    };

    const files = generateTypesPackage([dbEntityNode, messagesEntityNode, typesNode], [], [], []);

    const entitiesFile = files.find((f) => f.filename === "src/entities/index.ts");
    expect(entitiesFile).toBeDefined();
    // Tables should generate entity interfaces
    expect(entitiesFile!.content).toContain("export interface Conversations");
    expect(entitiesFile!.content).toContain("export interface Messages");
    // Should NOT generate clashing singular type aliases because custom types already define them
    expect(entitiesFile!.content).not.toContain("export type Conversation = Conversations;");
    expect(entitiesFile!.content).not.toContain("export type Message = Messages;");

    const customFile = files.find((f) => f.filename === "src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile!.content).toContain("export type Message = {");
    expect(customFile!.content).toContain("export type Conversation = {");

    const indexFile = files.find((f) => f.filename === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toContain('export * from "./entities";');
    expect(indexFile!.content).toContain('export * from "./custom";');
  });

  it("explicitly re-exports colliding types if entity table name directly collides with custom type", () => {
    // Exact table name collision: table is named "Conversation" (singular)
    const directEntityNode: BackendNode = {
      id: "entity-direct",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Conversation",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
        ],
      },
    };

    const typesNode: BackendNode = {
      id: "types-custom",
      type: "types",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Custom",
        definitionMode: "visual",
        types: [
          {
            id: "t1",
            name: "Conversation",
            kind: "type",
            typeAliasValue: "{ id: string; messages: string[] }",
          },
          {
            id: "t2",
            name: "Status",
            kind: "enum",
            enumValues: ["ACTIVE", "ARCHIVED"],
          },
        ],
      },
    };

    const files = generateTypesPackage([directEntityNode, typesNode], [], [], []);
    const indexFile = files.find((f) => f.filename === "src/index.ts");
    expect(indexFile).toBeDefined();
    // Explicit re-export should be present to resolve TS2308
    expect(indexFile!.content).toContain('export type { Conversation } from "./custom";');
  });

  it("exports singular and plural hook aliases in lib/stores/index.ts", () => {
    const files = generateZustandStores([
      {
        id: "store-1",
        name: "Conversation",
        scope: "global",
        storage: "memory",
        fields: [{ id: "f1", name: "messages", type: "array" }],
      },
    ]);

    const storeFile = files.find((f) => f.filename === "lib/stores/useConversationStore.ts");
    expect(storeFile).toBeDefined();
    expect(storeFile!.content).toContain("populate: (data?: Partial<ConversationStoreState>) => void;");

    const indexFile = files.find((f) => f.filename === "lib/stores/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toContain('export * from "./useConversationStore";');
    expect(indexFile!.content).toContain('export { default as useConversationStore } from "./useConversationStore";');
    expect(indexFile!.content).toContain('export { useConversationStore as useConversationsStore } from "./useConversationStore";');
  });
});
