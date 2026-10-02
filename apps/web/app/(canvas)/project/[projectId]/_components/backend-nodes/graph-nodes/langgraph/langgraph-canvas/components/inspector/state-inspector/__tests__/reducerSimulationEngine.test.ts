import { describe, it, expect } from "vitest";
import {
  executeAddMessagesReducer,
  executeAppendReducer,
  executeMergeObjectReducer,
  executeReducer,
  simulateStateTransition,
  buildInitialState,
} from "../utils/reducerSimulationEngine";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";

describe("reducerSimulationEngine", () => {
  describe("executeAddMessagesReducer", () => {
    it("should append a new message to the list", () => {
      const prev = [{ id: "1", role: "user", content: "hello" }];
      const next = [{ id: "2", role: "assistant", content: "hi" }];
      const result = executeAddMessagesReducer(prev, next);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ id: "2", role: "assistant", content: "hi" });
    });

    it("should update/replace an existing message matching the same id (deduplication)", () => {
      const prev = [
        { id: "1", role: "user", content: "hello" },
        { id: "2", role: "assistant", content: "generating..." },
      ];
      const next = [
        { id: "2", role: "assistant", content: "complete response" },
      ];
      const result = executeAddMessagesReducer(prev, next);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        id: "2",
        role: "assistant",
        content: "complete response",
      });
    });

    it("should handle single message object (not wrapped in array)", () => {
      const prev = [{ id: "1", role: "user", content: "first" }];
      const next = { id: "2", role: "assistant", content: "second" };
      const result = executeAddMessagesReducer(prev, next);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ id: "2", role: "assistant", content: "second" });
    });

    it("should normalize string message into an object with role 'user'", () => {
      const prev: unknown[] = [];
      const next = "Hello world";
      const result = executeAddMessagesReducer(prev, next);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: "user", content: "Hello world" });
    });
  });

  describe("executeAppendReducer", () => {
    it("should append single item to array", () => {
      const result = executeAppendReducer([1, 2], 3);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should concatenate arrays", () => {
      const result = executeAppendReducer(["a"], ["b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should handle null or undefined prev", () => {
      const result = executeAppendReducer(null, ["x"]);
      expect(result).toEqual(["x"]);
    });
  });

  describe("executeMergeObjectReducer", () => {
    it("should shallow merge dictionary keys", () => {
      const prev = { a: 1, b: 2 };
      const next = { b: 20, c: 3 };
      const result = executeMergeObjectReducer(prev, next);
      expect(result).toEqual({ a: 1, b: 20, c: 3 });
    });
  });

  describe("executeReducer", () => {
    it("should execute replace reducer", () => {
      const result = executeReducer("replace", undefined, "old", "new");
      expect(result.success).toBe(true);
      expect(result.result).toBe("new");
    });

    it("should execute custom reducer function code", () => {
      const code = "(prev, next) => (prev || 0) + (next || 0)";
      const result = executeReducer("custom", code, 10, 5);
      expect(result.success).toBe(true);
      expect(result.result).toBe(15);
    });

    it("should catch and return error for invalid custom reducer code", () => {
      const code = "(prev, next) => { throw new Error('Simulated failure'); }";
      const result = executeReducer("custom", code, {}, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Simulated failure");
    });
  });

  describe("simulateStateTransition", () => {
    const channels: LangGraphStateChannel[] = [
      { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
      { key: "count", type: "number", reducer: "replace", defaultValue: 0 },
      { key: "meta", type: "object", reducer: "merge_object", defaultValue: {} },
    ];

    it("should build initial state accurately from channel defaults", () => {
      const initial = buildInitialState(channels);
      expect(initial).toEqual({
        messages: [],
        count: 0,
        meta: {},
      });
    });

    it("should apply partial state update and track modified channels", () => {
      const currentState = {
        messages: [{ id: "m1", role: "user", content: "Hi" }],
        count: 1,
        meta: { env: "prod" },
      };

      const updatePayload = {
        count: 2,
        meta: { version: "1.0.0" },
      };

      const result = simulateStateTransition({
        stateChannels: channels,
        currentState,
        updatePayload,
      });

      expect(result.nextState.count).toBe(2);
      expect(result.nextState.meta).toEqual({ env: "prod", version: "1.0.0" });
      expect(result.nextState.messages).toEqual(currentState.messages);

      const countResult = result.channelResults.find((r) => r.channelKey === "count");
      expect(countResult?.status).toBe("updated");
      expect(countResult?.changed).toBe(true);

      const msgResult = result.channelResults.find((r) => r.channelKey === "messages");
      expect(msgResult?.status).toBe("unchanged");
      expect(msgResult?.changed).toBe(false);
    });

    it("should execute custom reducer tied to a channel", () => {
      const customChannels: LangGraphStateChannel[] = [
        {
          key: "score",
          type: "number",
          reducer: "sum_score",
          defaultValue: 0,
        },
      ];
      const customReducers: LangGraphCustomReducer[] = [
        {
          id: "r-sum",
          name: "sum_score",
          code: "(prev, next) => (prev || 0) + (next || 0)",
          targetField: "score",
        },
      ];

      const res = simulateStateTransition({
        stateChannels: customChannels,
        customReducers,
        currentState: { score: 10 },
        updatePayload: { score: 25 },
      });

      expect(res.nextState.score).toBe(35);
    });

    it("should capture unmatched keys from payload", () => {
      const res = simulateStateTransition({
        stateChannels: channels,
        currentState: { messages: [], count: 0, meta: {} },
        updatePayload: { unknown_field: "test" },
      });

      expect(res.unmatchedPayloadKeys).toContain("unknown_field");
    });
  });
});
