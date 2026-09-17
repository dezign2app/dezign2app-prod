import { describe, it, expect } from "vitest";
import {
  generateRedisOperations,
  getEntityDbOperations,
} from "../entityOperationsHelper";
import { BackendNode, DbOperationFunction } from "@/types/canvas";

describe("entityOperationsHelper - Redis Operations Generator", () => {
  describe("generateRedisOperations", () => {
    it("generates native Redis List operations for structure === 'list'", () => {
      const ops = generateRedisOperations("ChatMessage", {
        label: "ChatMessage",
        redisDataStructure: "list",
      });

      const opNames = ops.map((o) => o.name);
      expect(opNames).toEqual([
        "pushChatMessage",
        "popChatMessage",
        "getChatMessageList",
        "getChatMessageLength",
        "deleteChatMessage",
      ]);

      const pushOp = ops.find((o) => o.name === "pushChatMessage")!;
      expect(pushOp.code).toContain("redis.rpush(key, ...items)");
      expect(pushOp.kind).toBe("create");

      const popOp = ops.find((o) => o.name === "popChatMessage")!;
      expect(popOp.code).toContain("redis.lpop(key)");
      expect(popOp.kind).toBe("delete");

      const getListOp = ops.find((o) => o.name === "getChatMessageList")!;
      expect(getListOp.code).toContain("redis.lrange(key, start, stop)");
      expect(getListOp.kind).toBe("findAll");

      const getLenOp = ops.find((o) => o.name === "getChatMessageLength")!;
      expect(getLenOp.code).toContain("redis.llen(key)");
      expect(getLenOp.kind).toBe("findById");

      const delOp = ops.find((o) => o.name === "deleteChatMessage")!;
      expect(delOp.code).toContain("redis.del(key)");
      expect(delOp.kind).toBe("delete");
    });

    it("generates RedisJSON Array operations for structure === 'json' and jsonRootType === 'array'", () => {
      const ops = generateRedisOperations("Conversation", {
        label: "Conversation",
        redisDataStructure: "json",
        jsonRootType: "array",
      });

      const opNames = ops.map((o) => o.name);
      expect(opNames).toEqual([
        "appendConversationItem",
        "popConversationItem",
        "getRecentConversationItems",
        "getConversationLength",
        "getConversation",
        "setConversation",
        "deleteConversation",
      ]);

      const appendOp = ops.find((o) => o.name === "appendConversationItem")!;
      expect(appendOp.code).toContain('JSON.ARRAPPEND');
      expect(appendOp.kind).toBe("create");

      const popOp = ops.find((o) => o.name === "popConversationItem")!;
      expect(popOp.code).toContain('JSON.ARRPOP');
      expect(popOp.kind).toBe("delete");

      const recentOp = ops.find((o) => o.name === "getRecentConversationItems")!;
      expect(recentOp.code).toContain('JSON.GET');
      expect(recentOp.code).toContain("PATH");
      expect(recentOp.kind).toBe("findAll");

      const lenOp = ops.find((o) => o.name === "getConversationLength")!;
      expect(lenOp.code).toContain('JSON.ARRLEN');
      expect(lenOp.kind).toBe("findById");

      const getDocOp = ops.find((o) => o.name === "getConversation")!;
      expect(getDocOp.code).toContain('JSON.GET');

      const setDocOp = ops.find((o) => o.name === "setConversation")!;
      expect(setDocOp.code).toContain('JSON.SET');

      const delOp = ops.find((o) => o.name === "deleteConversation")!;
      expect(delOp.code).toContain("redis.del(key)");
    });

    it("generates standard Redis operations for structure === 'json' with jsonRootType === 'object'", () => {
      const ops = generateRedisOperations("UserSession", {
        label: "UserSession",
        redisDataStructure: "json",
        jsonRootType: "object",
      });

      const opNames = ops.map((o) => o.name);
      expect(opNames).toEqual([
        "getUserSession",
        "setUserSession",
        "deleteUserSession",
      ]);
    });

    it("generates Hash operations for structure === 'hash'", () => {
      const ops = generateRedisOperations("UserProfile", {
        label: "UserProfile",
        redisDataStructure: "hash",
      });

      const opNames = ops.map((o) => o.name);
      expect(opNames).toEqual([
        "getAllUserProfileFields",
        "getUserProfileField",
        "setUserProfileFields",
        "expireUserProfileField",
        "deleteUserProfile",
      ]);
    });
  });

  describe("getEntityDbOperations - Auto-refresh & Cleansing", () => {
    it("auto-generates List operations when node has no dbOperations", () => {
      const node: BackendNode = {
        id: "redis-node-1",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "TasksQueue",
          dbType: "redis",
          redisDataStructure: "list",
        },
      };

      const ops = getEntityDbOperations(node);
      expect(ops.map((o) => o.name)).toContain("pushTasksQueue");
      expect(ops.map((o) => o.name)).toContain("popTasksQueue");
      expect(ops.map((o) => o.name)).toContain("getTasksQueueList");
    });

    it("auto-cleanses stale auto-generated Hash operations when structure was changed to List", () => {
      const node: BackendNode = {
        id: "redis-node-1",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "Queue",
          dbType: "redis",
          redisDataStructure: "list", // switched to list!
          dbOperations: [
            {
              id: "redis-hgetall-queue",
              name: "getAllQueueFields",
              kind: "findAll",
              description: "Stale Hash op",
              signature: "getAllQueueFields(key: string): Promise<Record<string, string>>",
              params: [{ name: "key", type: "string", required: true }],
              returnType: "Promise<Record<string, string>>",
              code: "...",
              enabled: true,
              isAutoGenerated: true,
            },
          ],
        },
      };

      const ops = getEntityDbOperations(node);
      const opNames = ops.map((o) => o.name);
      // Stale hash operation should be replaced with native list operations
      expect(opNames).not.toContain("getAllQueueFields");
      expect(opNames).toContain("pushQueue");
      expect(opNames).toContain("popQueue");
      expect(opNames).toContain("getQueueList");
      expect(opNames).toContain("getQueueLength");
    });

    it("preserves custom operations while replacing stale auto-generated operations", () => {
      const customOp: DbOperationFunction = {
        id: "custom-my-op",
        name: "myCustomQueueProcessor",
        kind: "custom",
        description: "User written custom Redis op",
        signature: "myCustomQueueProcessor(key: string): Promise<void>",
        params: [{ name: "key", type: "string", required: true }],
        returnType: "Promise<void>",
        code: "export async function myCustomQueueProcessor() {}",
        enabled: true,
        isAutoGenerated: false,
      };

      const staleAutoOp: DbOperationFunction = {
        id: "redis-hgetall-queue",
        name: "getAllQueueFields",
        kind: "findAll",
        description: "Stale Hash op",
        signature: "getAllQueueFields(key: string): Promise<Record<string, string>>",
        params: [{ name: "key", type: "string", required: true }],
        returnType: "Promise<Record<string, string>>",
        code: "...",
        enabled: true,
        isAutoGenerated: true,
      };

      const node: BackendNode = {
        id: "redis-node-1",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "Queue",
          dbType: "redis",
          redisDataStructure: "list",
          dbOperations: [staleAutoOp, customOp],
        },
      };

      const ops = getEntityDbOperations(node);
      const opNames = ops.map((o) => o.name);
      expect(opNames).not.toContain("getAllQueueFields");
      expect(opNames).toContain("pushQueue");
      expect(opNames).toContain("myCustomQueueProcessor");
    });

    it("cleanses stale operations when toggling JSON object to JSON array", () => {
      const staleGenericGet: DbOperationFunction = {
        id: "redis-get-chat",
        name: "getChat",
        kind: "findById",
        description: "Generic string get",
        signature: "getChat(key: string): Promise<any>",
        params: [{ name: "key", type: "string", required: true }],
        returnType: "Promise<any>",
        code: "...",
        enabled: true,
        isAutoGenerated: true,
      };

      const node: BackendNode = {
        id: "redis-node-1",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "Chat",
          dbType: "redis",
          redisDataStructure: "json",
          jsonRootType: "array", // Toggled to array!
          dbOperations: [staleGenericGet],
        },
      };

      const ops = getEntityDbOperations(node);
      const opNames = ops.map((o) => o.name);
      expect(opNames).toContain("appendChatItem");
      expect(opNames).toContain("popChatItem");
      expect(opNames).toContain("getRecentChatItems");
      expect(opNames).toContain("getChatLength");
    });

    it("automatically cleanses stale generic operations (<T>) and replaces with typed Result envelopes", () => {
      const staleGenericConversationOp: DbOperationFunction = {
        id: "redis-json-get-conversation",
        name: "getConversation",
        kind: "findById",
        description: "Retrieve entire RedisJSON array document [Conversation] (JSON.GET)",
        signature: "getConversation<T = ConversationItem[]>(key: string): Promise<T | null>",
        params: [{ name: "key", type: "string", required: true }],
        returnType: "Promise<ConversationItem[] | null>",
        logicMode: "code",
        code: `export async function getConversation<T = ConversationItem[]>(key: string): Promise<T | null> {\n  const redis = await getRedisClient();\n  const res = await redis.call("JSON.GET", key);\n  if (!res) return null;\n  try { return JSON.parse(res as string) as T; } catch { return null; }\n}`,
        enabled: true,
        isAutoGenerated: true,
      };

      const node: BackendNode = {
        id: "redis-node-conv",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "Conversation",
          dbType: "redis",
          redisDataStructure: "json",
          jsonRootType: "array",
          dbOperations: [staleGenericConversationOp],
        },
      };

      const ops = getEntityDbOperations(node);
      const getConv = ops.find((o) => o.name === "getConversation");
      expect(getConv).toBeDefined();

      // Verify zero generic parameters remain in signature, code, or returnType
      expect(getConv!.signature).not.toContain("<T");
      expect(getConv!.code).not.toContain("<T");
      expect(getConv!.returnType).not.toContain("<T");

      // Verify it returns the concrete Promise<GetConversationResult>
      expect(getConv!.signature).toBe("getConversation(key: string): Promise<GetConversationResult>");
      expect(getConv!.returnType).toBe("Promise<GetConversationResult>");
      expect(getConv!.code).toContain("success: true");
      expect(getConv!.code).toContain("success: false");

      // Verify node.data.dbOperations was also updated in place
      expect(node.data.dbOperations).toBe(ops);
      expect(node.data.dbOperations!.some((o) => o.code?.includes("<T"))).toBe(false);

      // Verify zero any, unknown, or 'as <Type>' casts across all regenerated operations
      for (const op of ops) {
        if (!op.code) continue;
        expect(op.code).not.toMatch(/:\s*any\b/);
        expect(op.code).not.toMatch(/<any>/);
        expect(op.code).not.toMatch(/:\s*unknown\b/);
        expect(op.code).not.toMatch(/<unknown>/);
        expect(op.code).not.toMatch(/\bas\s+[A-Za-z0-9_]+/);
      }
    });
  });
});
