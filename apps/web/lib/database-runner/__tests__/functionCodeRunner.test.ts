import { describe, it, expect } from "vitest";
import { executeFunctionCode } from "../functionCodeRunner";

describe("functionCodeRunner", () => {
  it("executes the exact user code: function test() { return true; }", async () => {
    const res = await executeFunctionCode({
      name: "test",
      code: "function test(){\n  return true;\n}",
      args: { key: "conversations:1001" },
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe(true);
    expect(res.rawCommand).toContain("test(");
  });

  it("executes function with parameters", async () => {
    const res = await executeFunctionCode({
      name: "greet",
      code: "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}",
      params: [{ name: "name", type: "string" }],
      args: { name: "Alice" },
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe("Hello, Alice!");
  });

  it("executes async functions returning promises", async () => {
    const res = await executeFunctionCode({
      name: "fetchAsync",
      code: "export async function fetchAsync() {\n  return Promise.resolve({ success: true, count: 42 });\n}",
    });

    expect(res.success).toBe(true);
    expect(res.output).toEqual({ success: true, count: 42 });
  });

  it("executes top-level return statements without function wrapper", async () => {
    const res = await executeFunctionCode({
      name: "compute",
      code: "const x = 10;\nconst y = 20;\nreturn x + y;",
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe(30);
  });

  it("captures console logs", async () => {
    const res = await executeFunctionCode({
      name: "logged",
      code: "function logged() {\n  console.log('Running logged function');\n  return 'done';\n}",
    });

    expect(res.success).toBe(true);
    expect(res.output).toBe("done");
    expect(res.logs).toContain("Running logged function");
  });

  it("catches runtime errors gracefully", async () => {
    const res = await executeFunctionCode({
      name: "broken",
      code: "function broken() {\n  throw new Error('Something went wrong');\n}",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Something went wrong");
  });
});
