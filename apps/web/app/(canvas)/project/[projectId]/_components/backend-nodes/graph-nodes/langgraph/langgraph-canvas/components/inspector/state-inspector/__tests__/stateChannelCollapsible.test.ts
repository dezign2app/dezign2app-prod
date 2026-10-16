import { describe, it, expect } from "vitest";
import { getBuiltInReducerCode } from "../components/ChannelReducerConfig";
import {
  BUILT_IN_REDUCERS,
  REDUCER_CODE_PRESETS,
  getSuggestedReducerCodeForChannelType,
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
});
