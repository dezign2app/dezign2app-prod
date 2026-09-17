import { describe, it, expect } from "vitest";
import { compileRawSqliteDatabase } from "../databases/sqlite/raw";
import { getAvailableSources } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/sourcePaths";
import { BackendNode } from "@/types/canvas";
import { PipelineStepDraft } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/types";

describe("SQLite Primary Key Insertion and Message Field", () => {
  const messageEntityNode: BackendNode = {
    id: "node-entity-message",
    type: "entity",
    position: { x: 100, y: 100 },
    fractionalIndex: "a0",
    data: {
      label: "Message",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "conversation_id", type: "string" },
        { name: "content", type: "string" },
        { name: "sender", type: "string" },
      ],
    },
  };

  it("should generate DDL with PRIMARY KEY NOT NULL for text IDs and include id in stmtInsert", () => {
    const result = compileRawSqliteDatabase([messageEntityNode], []);

    const helpersFile = result.files.find((f) => f.filename.includes("helpers/message.ts"));
    expect(helpersFile).toBeDefined();
    const helperCode = helpersFile?.content || "";

    // 1. Should import randomUUID
    expect(helperCode).toContain('import { randomUUID } from "node:crypto";');

    // 2. stmtInsert must include "id" in column names
    expect(helperCode).toContain('"INSERT INTO message (id, conversation_id, content, sender) VALUES (?, ?, ?, ?)"');

    // 3. create function must generate or pass _rowId into stmtInsert
    expect(helperCode).toContain("const _rowId = data.id ||");
    expect(helperCode).toContain("stmtInsert.run(_rowId,");

    // 4. Returns must include descriptive message
    expect(helperCode).toContain('message: "Message created successfully"');
    expect(helperCode).toContain('message: "Message updated successfully"');
    expect(helperCode).toContain('message: "Message deleted successfully"');
    expect(helperCode).toContain("success: true");

    // 5. Check DDL in connection.ts
    const connFile = result.files.find((f) => f.filename.endsWith("connection.ts"));
    expect(connFile).toBeDefined();
    const connCode = connFile?.content || "";
    expect(connCode).toContain('TEXT PRIMARY KEY NOT NULL');
  });

  it("should surface id at the top and message + success in available pipeline step sources", () => {
    const priorStep: PipelineStepDraft = {
      id: "step-1",
      name: "createMessageResult",
      type: "db_operation",
      tableNodeId: "node-entity-message",
      outputVariable: "createMessageResult",
    };

    const sources = getAvailableSources(undefined, [priorStep], [messageEntityNode]);
    const stepSource = sources.find((s) => s.id === "step:step-1");

    expect(stepSource).toBeDefined();
    const paths = stepSource?.paths.map((p) => p.path) || [];

    // "id" must be at the very front
    expect(paths[0]).toBe("id");

    // Table columns
    expect(paths).toContain("conversation_id");
    expect(paths).toContain("content");
    expect(paths).toContain("sender");

    // Operational fields
    expect(paths).toContain("message");
    expect(paths).toContain("success");
  });

  it("should not produce duplicate identifier errors when entity already contains a message or success column", () => {
    const conversationEntityNode: BackendNode = {
      id: "node-entity-conversations",
      type: "entity",
      position: { x: 200, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "user_id", type: "string" },
          { name: "message", type: "string" },
          { name: "success", type: "boolean" },
        ],
      },
    };

    const result = compileRawSqliteDatabase([conversationEntityNode], []);
    const helperFile = result.files.find((f) => f.filename.includes("helpers/conversations.ts"));
    expect(helperFile).toBeDefined();
    const helperCode = helperFile?.content || "";

    // 1. In ConversationsRow, message: string and success: boolean must only appear once
    const rowTypeMatch = helperCode.match(/export type ConversationsRow = \{([\s\S]*?)\};/);
    expect(rowTypeMatch).toBeTruthy();
    const rowTypeBody = rowTypeMatch![1];

    const messageCount = (rowTypeBody?.match(/\bmessage(?:\?)?:/g) || []).length;
    expect(messageCount).toBe(1);
    expect(rowTypeBody).toContain("message: string;");
    expect(rowTypeBody).not.toContain("message?: string;");

    const successCount = (rowTypeBody?.match(/\bsuccess(?:\?)?:/g) || []).length;
    expect(successCount).toBe(1);
    expect(rowTypeBody).toContain("success: boolean;");
    expect(rowTypeBody).not.toContain("success?: boolean;");

    // 2. create function should preserve data.message and not clobber it with operational string
    expect(helperCode).not.toContain('message: "Conversation created successfully", ...data');
    expect(helperCode).toContain("return { id: _rowId, ...data");

    // 3. update function should preserve fresh.message and not clobber it with operational string
    expect(helperCode).not.toContain('message: "Conversation updated successfully"');
    expect(helperCode).toContain("return fresh ? ({ ...fresh } as unknown as ConversationsRow) : undefined;");

    // 4. connection.ts should generate schema auto-migration for existing tables
    const connFile = result.files.find((f) => f.filename.includes("connection.ts"));
    expect(connFile).toBeDefined();
    const connContent = connFile?.content || "";
    expect(connContent).toContain("Auto-migrate schema: ensure all defined columns exist");
    expect(connContent).toContain('ALTER TABLE "${tName}" ADD COLUMN "${col.name}" ${col.type}');
    expect(connContent).toContain('"conversations"');
    expect(connContent).toContain('"user_id"');
    expect(connContent).toContain('"message"');
    expect(connContent).toContain("DROP VIEW IF EXISTS");
  });
});

