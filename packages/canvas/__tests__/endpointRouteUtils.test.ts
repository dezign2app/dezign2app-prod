import { describe, it, expect } from "vitest";
import {
  formatEndpointRoute,
  sanitizeEndpointRoute,
  extractEndpointPathParams,
  extractEndpointQueryParams,
  parseEndpointRouteWithParams,
  syncEndpointRouteWithPathParams,
  reconcileEndpointPathParams,
  formatEndpointQueryString,
  computeCompiledEndpointRoute,
  deduplicateEndpointRoutePathParams,
  validateEndpointParamKeys,
} from "../utils";

describe("Endpoint Route Utilities", () => {
  describe("extractEndpointPathParams", () => {
    it("extracts Express style :param placeholders", () => {
      expect(extractEndpointPathParams("send-message/:hello")).toEqual(["hello"]);
      expect(extractEndpointPathParams("/api/orgs/:orgId/users/:userId")).toEqual([
        "orgId",
        "userId",
      ]);
    });

    it("extracts OpenAPI style {param} placeholders", () => {
      expect(extractEndpointPathParams("/users/{id}")).toEqual(["id"]);
      expect(extractEndpointPathParams("/orders/{orderId}/items/{itemId}")).toEqual([
        "orderId",
        "itemId",
      ]);
    });

    it("extracts bracket style [param] placeholders", () => {
      expect(extractEndpointPathParams("/users/[id]")).toEqual(["id"]);
    });

    it("ignores port numbers like :8080 or :3000", () => {
      expect(extractEndpointPathParams("http://localhost:8080/api/users/:id")).toEqual(["id"]);
      expect(extractEndpointPathParams("/service:3000/users")).toEqual([]);
    });

    it("ignores query parameters when extracting path params", () => {
      expect(extractEndpointPathParams("/users/:id?limit=10&sort=asc")).toEqual(["id"]);
    });

    it("returns empty array when no path params exist", () => {
      expect(extractEndpointPathParams("/health")).toEqual([]);
      expect(extractEndpointPathParams("send-message")).toEqual([]);
      expect(extractEndpointPathParams("")).toEqual([]);
    });
  });

  describe("extractEndpointQueryParams", () => {
    it("extracts query params from query string", () => {
      const params = extractEndpointQueryParams("limit=10&sort=asc&active=true");
      expect(params).toHaveLength(3);
      expect(params[0]).toEqual({
        id: "query-limit",
        name: "limit",
        type: "number",
        defaultValue: "10",
        required: false,
      });
      expect(params[1]).toEqual({
        id: "query-sort",
        name: "sort",
        type: "string",
        defaultValue: "asc",
        required: false,
      });
      expect(params[2]).toEqual({
        id: "query-active",
        name: "active",
        type: "boolean",
        defaultValue: "true",
        required: false,
      });
    });

    it("extracts query params from full URL with '?'", () => {
      const params = extractEndpointQueryParams("/users/:id?filter=admin");
      expect(params).toHaveLength(1);
      expect(params[0]?.name).toBe("filter");
    });

    it("returns empty array when no query string exists", () => {
      expect(extractEndpointQueryParams("/users/:id")).toEqual([]);
      expect(extractEndpointQueryParams("")).toEqual([]);
    });
  });

  describe("parseEndpointRouteWithParams", () => {
    it("parses route with both path params and query params", () => {
      const res = parseEndpointRouteWithParams("/users/:id?limit=20&sort=asc");
      expect(res.route).toBe("/users/:id");
      expect(res.extractedPathParams).toHaveLength(1);
      expect(res.extractedPathParams[0]?.name).toBe("id");
      expect(res.extractedQueryParams).toHaveLength(2);
      expect(res.extractedQueryParams.map((q) => q.name)).toEqual(["limit", "sort"]);
    });

    it("parses route with spaces by transforming to hyphens", () => {
      const res = parseEndpointRouteWithParams("send message/:hello");
      expect(res.route).toBe("send-message/:hello");
      expect(res.extractedPathParams[0]?.name).toBe("hello");
    });
  });

  describe("syncEndpointRouteWithPathParams", () => {
    it("appends path param to unslashed route 'send-message'", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "send-message",
        oldPathParams: [],
        newPathParams: [{ id: "p1", name: "hello" }],
      });
      expect(route).toBe("send-message/:hello");
    });

    it("appends path param to slashed route '/send-message'", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/send-message",
        oldPathParams: [],
        newPathParams: [{ id: "p1", name: "hello" }],
      });
      expect(route).toBe("/send-message/:hello");
    });

    it("appends multiple path params in order", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/api/users",
        oldPathParams: [],
        newPathParams: [
          { id: "p1", name: "userId" },
          { id: "p2", name: "postId" },
        ],
      });
      expect(route).toBe("/api/users/:userId/:postId");
    });

    it("renames parameter when updated in newPathParams", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/api/users/:id",
        oldPathParams: [{ id: "p1", name: "id" }],
        newPathParams: [{ id: "p1", name: "userId" }],
      });
      expect(route).toBe("/api/users/:userId");
    });

    it("renames parameter when OpenAPI brace syntax {id} was in route", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/api/users/{id}",
        oldPathParams: [{ id: "p1", name: "id" }],
        newPathParams: [{ id: "p1", name: "userId" }],
      });
      expect(route).toBe("/api/users/:userId");
    });

    it("removes parameter when deleted from newPathParams", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/api/users/:id",
        oldPathParams: [{ id: "p1", name: "id" }],
        newPathParams: [],
      });
      expect(route).toBe("/api/users");
    });

    it("removes middle parameter when deleted", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "/orgs/:orgId/users/:userId",
        oldPathParams: [
          { id: "p1", name: "orgId" },
          { id: "p2", name: "userId" },
        ],
        newPathParams: [{ id: "p2", name: "userId" }],
      });
      expect(route).toBe("/orgs/users/:userId");
    });

    it("does not duplicate if param already in route", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "send-message/:hello",
        oldPathParams: [{ id: "p1", name: "hello" }],
        newPathParams: [{ id: "p1", name: "hello" }],
      });
      expect(route).toBe("send-message/:hello");
    });

    it("handles empty currentRoute", () => {
      const route = syncEndpointRouteWithPathParams({
        currentRoute: "",
        oldPathParams: [],
        newPathParams: [{ id: "p1", name: "id" }],
      });
      expect(route).toBe("/:id");
    });
  });

  describe("reconcileEndpointPathParams", () => {
    it("adds newly typed param to pathParams", () => {
      const result = reconcileEndpointPathParams({
        currentPathParams: [],
        newRoute: "send-message/:hello",
        oldRoute: "send-message",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("hello");
      expect(result[0]?.required).toBe(true);
      expect(result[0]?.type).toBe("string");
    });

    it("preserves existing parameter configuration", () => {
      const result = reconcileEndpointPathParams({
        currentPathParams: [
          {
            id: "custom-id",
            name: "hello",
            type: "number",
            required: false,
            description: "greeting code",
          },
        ],
        newRoute: "send-message/:hello",
        oldRoute: "send-message",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("custom-id");
      expect(result[0]?.type).toBe("number");
      expect(result[0]?.description).toBe("greeting code");
    });

    it("renames parameter when route param is renamed", () => {
      const result = reconcileEndpointPathParams({
        currentPathParams: [
          { id: "p1", name: "hello", type: "string", required: true },
        ],
        newRoute: "send-message/:messageId",
        oldRoute: "send-message/:hello",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("p1");
      expect(result[0]?.name).toBe("messageId");
    });

    it("removes parameter when param is deleted from route", () => {
      const result = reconcileEndpointPathParams({
        currentPathParams: [
          { id: "p1", name: "hello", type: "string", required: true },
        ],
        newRoute: "send-message",
        oldRoute: "send-message/:hello",
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("formatEndpointQueryString", () => {
    it("returns empty string when queryParams is empty or undefined", () => {
      expect(formatEndpointQueryString()).toBe("");
      expect(formatEndpointQueryString([])).toBe("");
    });

    it("formats query params with default values as ?key=defaultvalue&key2=&key3=value", () => {
      expect(
        formatEndpointQueryString([
          { name: "key", defaultValue: "defaultvalue" },
          { name: "key2" },
          { name: "key3", defaultValue: "value" },
        ]),
      ).toBe("?key=defaultvalue&key2=&key3=value");
    });

    it("ignores query parameters with empty or whitespace names", () => {
      expect(
        formatEndpointQueryString([
          { name: "" },
          { name: "  " },
          { name: "valid", defaultValue: "123" },
        ]),
      ).toBe("?valid=123");
    });
  });

  describe("computeCompiledEndpointRoute", () => {
    it("returns clean route if no query params", () => {
      expect(computeCompiledEndpointRoute({ route: "/users/:id" })).toBe("/users/:id");
    });

    it("formats query params after '?' with default values", () => {
      expect(
        computeCompiledEndpointRoute({
          route: "/send-message/:hello",
          queryParams: [
            { name: "sort", defaultValue: "asc" },
            { name: "limit", defaultValue: "20" },
            { name: "verbose" },
          ],
        }),
      ).toBe("/send-message/:hello?sort=asc&limit=20&verbose=");
    });

    it("handles key=defaultvalue&key2=&key3=value format", () => {
      expect(
        computeCompiledEndpointRoute({
          route: "send-message/:hello",
          queryParams: [
            { name: "key", defaultValue: "defaultvalue" },
            { name: "key2" },
            { name: "key3", defaultValue: "value" },
          ],
        }),
      ).toBe("send-message/:hello?key=defaultvalue&key2=&key3=value");
    });

    it("deduplicates path parameters and excludes query params that match path params", () => {
      expect(
        computeCompiledEndpointRoute({
          route: "send-message/:id/:id",
          queryParams: [
            { name: "id", defaultValue: "123" },
            { name: "hello", defaultValue: "sub" },
            { name: "hello", defaultValue: "ignored" },
          ],
        }),
      ).toBe("send-message/:id?hello=sub");
    });
  });

  describe("deduplicateEndpointRoutePathParams", () => {
    it("deduplicates duplicate Express :id placeholders", () => {
      expect(deduplicateEndpointRoutePathParams("send-message/:id/:id")).toBe("send-message/:id");
      expect(deduplicateEndpointRoutePathParams("/:id/:id")).toBe("/:id");
      expect(deduplicateEndpointRoutePathParams("/users/:id/sub/:id")).toBe("/users/:id/sub");
    });

    it("deduplicates duplicate OpenAPI {id} placeholders", () => {
      expect(deduplicateEndpointRoutePathParams("/users/{id}/details/{id}")).toBe(
        "/users/{id}/details",
      );
    });

    it("deduplicates duplicate bracket [id] placeholders", () => {
      expect(deduplicateEndpointRoutePathParams("/items/[id]/[id]")).toBe("/items/[id]");
    });

    it("cleans duplicate query keys and query keys that duplicate path params", () => {
      expect(
        deduplicateEndpointRoutePathParams("send-message/:id/:id?hello&hello&id=123"),
      ).toBe("send-message/:id?hello=");
    });
  });

  describe("sanitizeEndpointRoute deduplication", () => {
    it("removes duplicate dynamic path segments when sanitizing route", () => {
      expect(sanitizeEndpointRoute("send-message/:id/:id")).toBe("send-message/:id");
    });
  });

  describe("syncEndpointRouteWithPathParams duplicate prevention", () => {
    it("does not append duplicate path parameters even if newPathParams has duplicate names", () => {
      expect(
        syncEndpointRouteWithPathParams({
          currentRoute: "send-message",
          newPathParams: [
            { id: "p1", name: "id" },
            { id: "p2", name: "id" },
          ],
        }),
      ).toBe("send-message/:id");
    });

    it("deduplicates pre-existing duplicate segments in currentRoute", () => {
      expect(
        syncEndpointRouteWithPathParams({
          currentRoute: "send-message/:id/:id",
          newPathParams: [{ id: "p1", name: "id" }],
        }),
      ).toBe("send-message/:id");
    });
  });

  describe("validateEndpointParamKeys", () => {
    it("returns valid when all keys are unique and non-overlapping", () => {
      const result = validateEndpointParamKeys({
        pathParams: [{ name: "id" }, { name: "orgId" }],
        queryParams: [{ name: "sort" }, { name: "limit" }],
      });
      expect(result.isValid).toBe(true);
      expect(result.duplicatePathParams).toHaveLength(0);
      expect(result.duplicateQueryParams).toHaveLength(0);
      expect(result.conflictingParams).toHaveLength(0);
    });

    it("detects duplicate path parameters", () => {
      const result = validateEndpointParamKeys({
        pathParams: [{ name: "id" }, { name: "id" }],
      });
      expect(result.isValid).toBe(false);
      expect(result.duplicatePathParams).toEqual(["id"]);
    });

    it("detects duplicate query parameters", () => {
      const result = validateEndpointParamKeys({
        queryParams: [{ name: "hello" }, { name: "hello" }],
      });
      expect(result.isValid).toBe(false);
      expect(result.duplicateQueryParams).toEqual(["hello"]);
    });

    it("detects conflicting keys shared between path params and query params", () => {
      const result = validateEndpointParamKeys({
        pathParams: [{ name: "id" }],
        queryParams: [{ name: "id" }, { name: "sort" }],
      });
      expect(result.isValid).toBe(false);
      expect(result.conflictingParams).toEqual(["id"]);
      expect(result.errors).toContain(
        'Parameter "id" cannot be used as both a path parameter and a query parameter.',
      );
    });
  });
});
