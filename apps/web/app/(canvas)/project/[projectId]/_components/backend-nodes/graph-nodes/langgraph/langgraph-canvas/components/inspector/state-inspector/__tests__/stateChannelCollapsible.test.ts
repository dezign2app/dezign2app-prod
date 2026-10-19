import { describe, it, expect } from "vitest";
import { getBuiltInReducerCode } from "../components/ChannelReducerConfig";
import {
  BUILT_IN_REDUCERS,
  REDUCER_CODE_PRESETS,
  getSuggestedReducerCodeForChannelType,
  isReducerCodeCompatibleWithType,
} from "../constants";

describe("State Channel Reducer Configuration", () => {
  describe("getBuiltInReducerCode", () => {
    it("returns direct assignment for replace", () => {
      expect(getBuiltInReducerCode("replace")).toBe("(prev, next) => next");
    });

    it("returns chat deduplication and append for add_messages", () => {
      const code = getBuiltInReducerCode("add_messages");
      expect(code).toContain("Array.isArray(prev)");
      expect(code).toContain("Array.isArray(next)");
    });

    it("returns array concat for append and concat_array", () => {
      const appendCode = getBuiltInReducerCode("append");
      const concatCode = getBuiltInReducerCode("concat_array");
      expect(appendCode).toContain("[...(Array.isArray(prev)");
      expect(concatCode).toBe(appendCode);
    });

    it("returns shallow dict merge for merge_object", () => {
      expect(getBuiltInReducerCode("merge_object")).toBe(
        "(prev, next) => ({ ...(prev || {}), ...(next || {}) })",
      );
    });

    it("defaults to replace for unknown reducer name", () => {
      expect(getBuiltInReducerCode("custom_unknown")).toBe("(prev, next) => next");
    });
  });

  describe("getSuggestedReducerCodeForChannelType", () => {
    it("suggests action-aware reducer for number channels with replace, increment, decrement, reset", () => {
      const code = getSuggestedReducerCodeForChannelType("number");
      expect(code).toBe(REDUCER_CODE_PRESETS.number);
      expect(code).toContain("next?.action");
      expect(code).toContain('action === "replace"');
      expect(code).toContain('action === "increment"');
      expect(code).toContain('action === "decrement"');
      expect(code).toContain('action === "reset"');
    });

    it("supports action-based counter reducer preset (increment, decrement, reset, replace)", () => {
      const code = REDUCER_CODE_PRESETS.counterActions;
      expect(code).toContain('action === "replace"');
      expect(code).toContain("increment");
      expect(code).toContain("decrement");
      expect(code).toContain("reset");
    });

    it("suggests append with replace action for array and messages channels", () => {
      const arrayCode = getSuggestedReducerCodeForChannelType("array");
      expect(arrayCode).toBe(REDUCER_CODE_PRESETS.array);
      expect(arrayCode).toContain('action === "replace"');
      expect(arrayCode).toContain("next?.action");

      const chatCode = getSuggestedReducerCodeForChannelType("messages");
      expect(chatCode).toBe(REDUCER_CODE_PRESETS.chat);
      expect(chatCode).toContain('action === "replace"');
    });

    it("suggests object merge with replace action for object and json channels", () => {
      const objCode = getSuggestedReducerCodeForChannelType("object");
      expect(objCode).toBe(REDUCER_CODE_PRESETS.object);
      expect(objCode).toContain('action === "replace"');
      expect(getSuggestedReducerCodeForChannelType("json")).toBe(
        REDUCER_CODE_PRESETS.object,
      );
    });

    it("suggests string concat with replace action for string channels", () => {
      const strCode = getSuggestedReducerCodeForChannelType("string");
      expect(strCode).toBe(REDUCER_CODE_PRESETS.string);
      expect(strCode).toContain('action === "replace"');
      expect(strCode).toContain('action === "prepend"');

      // Test evaluation of the string reducer
      const fn = new Function("return " + strCode)();
      // Default: concats incoming text directly (with optional separator)
      expect(fn("", "first line")).toBe("first line");
      expect(fn("first", " second")).toBe("first second");
      expect(fn("first", { value: "second", separator: " " })).toBe("first second");
      // Prepend
      expect(fn("world", { action: "prepend", value: "hello " })).toBe("hello world");
      // Replace
      expect(fn("old", { action: "replace", value: "new" })).toBe("new");
      // Reset / clear
      expect(fn("old", { action: "clear" })).toBe("");
      expect(fn("old", { action: "reset" })).toBe("");
    });

    it("suggests boolean toggle with replace action for boolean channels", () => {
      const boolCode = getSuggestedReducerCodeForChannelType("boolean");
      expect(boolCode).toBe(REDUCER_CODE_PRESETS.boolean);
      expect(boolCode).toContain('action === "replace"');
      expect(boolCode).toContain('action === "toggle"');
    });
  });

  describe("Built-in Reducers Catalog", () => {
    it("has 5 standard built-in reducers", () => {
      expect(BUILT_IN_REDUCERS).toHaveLength(5);
      const names = BUILT_IN_REDUCERS.map((r) => r.name);
      expect(names).toContain("replace");
      expect(names).toContain("add_messages");
      expect(names).toContain("append");
      expect(names).toContain("concat_array");
      expect(names).toContain("merge_object");
    });
  });

  describe("isReducerCodeCompatibleWithType", () => {
    it("detects string reducer code is incompatible with number channels", () => {
      const stringCode = REDUCER_CODE_PRESETS.string;
      expect(isReducerCodeCompatibleWithType(stringCode, "number")).toBe(false);
    });

    it("detects number reducer code is compatible with number channels", () => {
      const numberCode = REDUCER_CODE_PRESETS.number;
      expect(isReducerCodeCompatibleWithType(numberCode, "number")).toBe(true);
    });

    it("executes number reducer correctly without string coercion", () => {
      // Evaluate the generated number reducer function
      const fn = new Function("return " + REDUCER_CODE_PRESETS.number)();

      // Default set: passes raw number or object value
      expect(fn(0, 5)).toBe(5);
      expect(fn(5, { value: 42 })).toBe(42);

      // Replace / set action
      expect(fn(10, { action: "replace", value: 99 })).toBe(99);
      expect(fn(10, { action: "set", value: 100 })).toBe(100);

      // Increment / add action
      expect(fn(10, { action: "increment", amount: 3 })).toBe(13);
      expect(fn(10, { action: "add", value: 5 })).toBe(15);

      // Decrement / subtract action
      expect(fn(10, { action: "decrement", amount: 2 })).toBe(8);
      expect(fn(10, { action: "subtract", value: 4 })).toBe(6);

      // Reset / clear action
      expect(fn(10, { action: "reset" })).toBe(0);
      expect(fn(10, { action: "clear" })).toBe(0);
    });
  });
});
