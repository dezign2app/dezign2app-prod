import { describe, it, expect } from "vitest";
import { extractDbOperationParams } from "../entityOperationsHelper";
import { generateDefaultParams } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/entity-functions-config/test-studio/testStudioUtils";
import { DbOperationFunction, CanvasEntityColumn } from "@workspace/canvas/types";

describe("extractDbOperationParams", () => {
  it("extracts parameters from async function code", () => {
    const code = `export async function createTest(data: CreateTestData): Promise<TestRow> {
      return await query('INSERT ...');
    }`;
    const params = extractDbOperationParams(code);
    expect(params).toEqual([
      { name: "data", type: "CreateTestData", required: true },
    ]);
  });

  it("extracts multiple typed and optional parameters", () => {
    const code = `async function updateItem(id: string, count?: number, active = true) {}`;
    const params = extractDbOperationParams(code);
    expect(params).toEqual([
      { name: "id", type: "string", required: true },
      { name: "count", type: "number", required: false },
      { name: "active", type: "boolean", required: false },
    ]);
  });

  it("returns empty array for parameterless functions", () => {
    const code = `export function getStats(): Promise<Stats> {}`;
    const params = extractDbOperationParams(code);
    expect(params).toEqual([]);
  });

  it("returns null for non-function code bodies", () => {
    const code = `const a = 1;\nreturn a;`;
    const params = extractDbOperationParams(code);
    expect(params).toBeNull();
  });
});

describe("generateDefaultParams", () => {
  const mockOp: DbOperationFunction = {
    id: "auto-create-test",
    name: "createTest",
    kind: "create",
    signature: "createTest(data: CreateTestData): Promise<TestRow>",
    params: [{ name: "data", type: "CreateTestData", required: true }],
    returnType: "Promise<TestRow>",
    logicMode: "code",
    code: "",
    enabled: true,
  };

  it("generates sample payload with ONLY the table columns when table has 1 column", () => {
    const columns: CanvasEntityColumn[] = [
      { name: "id", type: "TEXT", isPrimaryKey: true },
    ];
    const params = generateDefaultParams(mockOp, "test", false, columns);
    expect(params.data).toEqual({
      id: "test_1",
    });
    // Must NOT contain dummy title or timestamp!
    expect(params.data).not.toHaveProperty("title");
    expect(params.data).not.toHaveProperty("timestamp");
  });

  it("generates sample payload matching all defined columns", () => {
    const columns: CanvasEntityColumn[] = [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "email", type: "VARCHAR" },
      { name: "count", type: "INTEGER" },
      { name: "is_active", type: "BOOLEAN" },
    ];
    const params = generateDefaultParams(mockOp, "test", false, columns);
    expect(params.data).toEqual({
      id: "test_1",
      email: "user@example.com",
      count: 10,
      is_active: true,
    });
  });

  it("handles destructured { id } parameters seamlessly", () => {
    const destructuredOp: DbOperationFunction = {
      ...mockOp,
      signature: "createTest({ id }: CreateTestData): Promise<TestRow>",
      params: [{ name: "{ id }", type: "CreateTestData", required: true }],
    };
    const columns: CanvasEntityColumn[] = [
      { name: "id", type: "TEXT", isPrimaryKey: true },
    ];
    const params = generateDefaultParams(destructuredOp, "test", false, columns);
    expect(params["{ id }"]).toEqual({
      id: "test_1",
    });
  });
});

describe("PostgreSQL generated operations type safety", () => {
  it("avoids any, unknown, or as type assertions in generated postgres default operations", async () => {
    const { generateDefaultDbOperationsForEngine } = await import("../entityOperationsHelper");
    const ops = generateDefaultDbOperationsForEngine(
      "test",
      [{ name: "id", type: "TEXT", isPrimaryKey: true }],
      [],
      [],
      "postgres",
    );
    for (const op of ops) {
      if (op.code) {
        expect(op.code).not.toContain("as unknown as");
        expect(op.code).not.toContain("as TestRow");
        expect(op.code).not.toContain("as any");
        expect(op.code).not.toContain("unknown");
      }
    }
  });
});

