import { describe, it, expect } from "vitest";
import { inferDbOperationReturnType } from "../inferDbOperationReturnType";

describe("inferDbOperationReturnType", () => {
  const options = { pascalLabel: "Conversations", tableName: "conversations" };

  it("infers boolean from user screenshot exact code: function test() { return true; }", () => {
    const code = `function test(){\n  return true;\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("boolean");
  });

  it("infers boolean from return false", () => {
    const code = `export function check() {\n  return false;\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("boolean");
  });

  it("infers explicit TypeScript function return type annotation", () => {
    const code = `export function test(): boolean {\n  return true;\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("boolean");
  });

  it("infers explicit Promise return type annotation", () => {
    const code = `export async function getConversations(): Promise<ConversationsRow[]> {\n  return [];\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("Promise<ConversationsRow[]>");
  });

  it("infers explicit arrow function return type annotation", () => {
    const code = `const findActive = async (): Promise<boolean> => {\n  return true;\n};`;
    expect(inferDbOperationReturnType(code, options)).toBe("Promise<boolean>");
  });

  it("infers number from numeric literals and expressions", () => {
    const code1 = `function getCount() {\n  return 42;\n}`;
    expect(inferDbOperationReturnType(code1, options)).toBe("number");

    const code2 = `function getLen(arr: string[]) {\n  return arr.length;\n}`;
    expect(inferDbOperationReturnType(code2, options)).toBe("number");
  });

  it("infers string from string literals and expressions", () => {
    const code1 = `function getName() {\n  return "test";\n}`;
    expect(inferDbOperationReturnType(code1, options)).toBe("string");

    const code2 = `function getMsg() {\n  return \`Hello \${id}\`;\n}`;
    expect(inferDbOperationReturnType(code2, options)).toBe("string");
  });

  it("infers type assertion in return statements", () => {
    const code = `export function findAll(): any {\n  return stmtFindAll.all() as unknown as ConversationsRow[];\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("ConversationsRow[]");
  });

  it("infers prepared statement .all(), .get(), .run() calls", () => {
    const codeAll = `function getAll() {\n  return stmtFindAll.all(20, 0);\n}`;
    expect(inferDbOperationReturnType(codeAll, options)).toBe("ConversationsRow[]");

    const codeGet = `function getOne(id: string) {\n  return stmtFindById.get(id);\n}`;
    expect(inferDbOperationReturnType(codeGet, options)).toBe("ConversationsRow | undefined");

    const codeRun = `function del(id: string) {\n  stmtDelete.run(id);\n  return { success: true, message: "deleted" };\n}`;
    expect(inferDbOperationReturnType(codeRun, options)).toBe("{ success: boolean; message: string }");
  });

  it("infers union types for nullable branches", () => {
    const code = `function find(id: string) {\n  const row = stmt.get(id);\n  if (!row) return undefined;\n  return row;\n}`;
    expect(inferDbOperationReturnType(code, options)).toBe("ConversationsRow | undefined");
  });

  it("infers Redis operations", () => {
    const codeGet = `const redis = await getRedisClient();\nreturn redis.get(key);`;
    expect(inferDbOperationReturnType(codeGet, options)).toBe("Promise<string | null>");

    const codeLen = `const redis = await getRedisClient();\nreturn redis.hlen(key);`;
    expect(inferDbOperationReturnType(codeLen, options)).toBe("Promise<number>");
  });

  it("infers raw SQL queries", () => {
    expect(inferDbOperationReturnType("SELECT COUNT(*) FROM conversations", options)).toBe("number");
    expect(inferDbOperationReturnType("SELECT EXISTS(SELECT 1 FROM conversations)", options)).toBe("boolean");
    expect(inferDbOperationReturnType("SELECT * FROM conversations LIMIT 10", options)).toBe("ConversationsRow[]");
    expect(inferDbOperationReturnType("DELETE FROM conversations WHERE id = ?", options)).toBe("{ success: boolean; message: string }");
  });

  it("infers void when there is no return statement", () => {
    const code = `console.log("hello");\nstmt.run(1);`;
    expect(inferDbOperationReturnType(code, options)).toBe("void");
  });

  it("returns fallback for empty code", () => {
    expect(inferDbOperationReturnType("", options)).toBe("ConversationsRow[]");
  });
});
