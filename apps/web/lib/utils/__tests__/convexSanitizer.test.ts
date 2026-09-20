import { describe, it, expect } from "vitest";
import { sanitizeForConvex } from "../convexSanitizer";

describe("sanitizeForConvex", () => {
  it("unwraps single-key RedisJSON paths starting with $", () => {
    const input = {
      "$[-20:]": [
        { id: "1", text: "hello" },
        { id: "2", text: "world" },
      ],
    };
    const output = sanitizeForConvex(input);
    expect(output).toEqual([
      { id: "1", text: "hello" },
      { id: "2", text: "world" },
    ]);
  });

  it("unwraps single root $ path", () => {
    const input = {
      "$": { name: "test-user" },
    };
    const output = sanitizeForConvex(input);
    expect(output).toEqual({ name: "test-user" });
  });

  it("prefixes multi-key or deep fields starting with $ or _", () => {
    const input = {
      "$[-20:]": [1, 2],
      "$meta": "info",
      "_secret": "pass",
      normal: 123,
    };
    const output = sanitizeForConvex(input);
    expect(output).toEqual({
      "val_$[-20:]": [1, 2],
      "val_$meta": "info",
      "val__secret": "pass",
      normal: 123,
    });
  });

  it("sanitizes nested test case output in node data", () => {
    const nodeData = {
      label: "ConversationItems",
      dbOperations: [
        {
          id: "getRecentItems",
          name: "getRecentItems",
          testCases: [
            {
              id: "case-1",
              name: "Standard Case",
              params: { count: 20 },
              lastResult: {
                success: true,
                output: {
                  "$[-20:]": [{ msg: "hi" }],
                },
              },
            },
          ],
        },
      ],
    };

    const sanitized = sanitizeForConvex(nodeData);
    expect(sanitized.dbOperations?.[0]?.testCases?.[0]?.lastResult?.output).toEqual([
      { msg: "hi" },
    ]);
  });

  it("omits undefined fields and fixes empty keys", () => {
    const input = {
      valid: "yes",
      skipMe: undefined,
      "": "empty-val",
    };
    const output = sanitizeForConvex(input);
    expect(output).toEqual({
      valid: "yes",
      empty_key: "empty-val",
    });
  });

  it("converts Date objects into ISO 8601 strings for Convex compatibility", () => {
    const testDate = new Date("2026-09-20T09:55:59.585Z");
    const nodeData = {
      label: "Test",
      dbOperations: [
        {
          id: "findAll",
        },
        {
          id: "findById",
        },
        {
          id: "createTest",
          testCases: [
            {
              id: "case-1",
              lastResult: {
                success: true,
                output: {
                  id: "test_1",
                  created_at: testDate,
                },
              },
            },
          ],
        },
      ],
    };

    const sanitized = sanitizeForConvex(nodeData);
    expect(
      sanitized.dbOperations?.[2]?.testCases?.[0]?.lastResult?.output?.created_at,
    ).toBe("2026-09-20T09:55:59.585Z");
    expect(
      typeof sanitized.dbOperations?.[2]?.testCases?.[0]?.lastResult?.output?.created_at,
    ).toBe("string");
  });

  it("converts invalid Date objects to null", () => {
    const invalidDate = new Date("invalid date string");
    const output = sanitizeForConvex({ date: invalidDate });
    expect(output).toEqual({ date: null });
  });
});
