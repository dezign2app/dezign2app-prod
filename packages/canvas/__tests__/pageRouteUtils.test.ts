import { describe, it, expect } from "vitest";
import { normalizePageRoute, arePageRoutesEqual, parsePageRoute, pageRouteToFolderPath, pageRouteToUrl, parseRouteWithQueryParams, computeCompiledPageRoute, syncRouteWithUpdatedPathParams } from "../utils";

describe("normalizePageRoute & arePageRoutesEqual", () => {
  describe("Route canonical equivalence: '/<route>' and '<route>' are the same", () => {
    it("normalizes '/login' and 'login' to '/login'", () => {
      expect(normalizePageRoute("login")).toBe("/login");
      expect(normalizePageRoute("/login")).toBe("/login");
      expect(arePageRoutesEqual("login", "/login")).toBe(true);
      expect(arePageRoutesEqual("/login", "login")).toBe(true);
    });

    it("handles whitespace and casing", () => {
      expect(arePageRoutesEqual("  /login  ", "login")).toBe(true);
      expect(arePageRoutesEqual("/Login", "login")).toBe(true);
      expect(arePageRoutesEqual("LOGIN", "/login")).toBe(true);
    });

    it("normalizes nested routes identically with or without leading slash", () => {
      expect(normalizePageRoute("dashboard/settings")).toBe("/dashboard/settings");
      expect(normalizePageRoute("/dashboard/settings")).toBe("/dashboard/settings");
      expect(normalizePageRoute("/dashboard/settings/")).toBe("/dashboard/settings");
      expect(arePageRoutesEqual("dashboard/settings", "/dashboard/settings")).toBe(true);
      expect(arePageRoutesEqual("/dashboard/settings/", "dashboard/settings")).toBe(true);
    });

    it("normalizes root and index variants", () => {
      expect(normalizePageRoute("/")).toBe("/");
      expect(normalizePageRoute("")).toBe("/");
      expect(normalizePageRoute("home")).toBe("/");
      expect(normalizePageRoute("/home")).toBe("/");
      expect(normalizePageRoute("index")).toBe("/");
      expect(normalizePageRoute("/index")).toBe("/");
      expect(arePageRoutesEqual("/", "")).toBe(true);
      expect(arePageRoutesEqual("/", "home")).toBe(true);
      expect(arePageRoutesEqual("/home", "/")).toBe(true);
      expect(arePageRoutesEqual("home", "index")).toBe(true);
    });

    it("handles layout specially without forcing a slash", () => {
      expect(normalizePageRoute("layout")).toBe("layout");
      expect(normalizePageRoute("/layout")).toBe("layout");
      expect(normalizePageRoute("Layout")).toBe("layout");
      expect(arePageRoutesEqual("layout", "/layout")).toBe(true);
      expect(arePageRoutesEqual("layout", "Layout")).toBe(true);
    });

    it("distinguishes different routes", () => {
      expect(arePageRoutesEqual("/login", "/register")).toBe(false);
      expect(arePageRoutesEqual("login", "dashboard")).toBe(false);
      expect(arePageRoutesEqual("dashboard", "layout")).toBe(false);
    });

    it("handles dynamic route segments", () => {
      expect(normalizePageRoute("users/[id]")).toBe("/users/[id]");
      expect(normalizePageRoute("/users/[id]")).toBe("/users/[id]");
      expect(arePageRoutesEqual("users/[id]", "/users/[id]")).toBe(true);
    });
  });

  describe("pageRouteToFolderPath and pageRouteToUrl consistency", () => {
    it("converts routes to clean folder paths and url paths", () => {
      expect(pageRouteToFolderPath("login")).toBe("login");
      expect(pageRouteToFolderPath("/login")).toBe("login");
      expect(pageRouteToUrl("login")).toBe("/login");
      expect(pageRouteToUrl("/login")).toBe("/login");
      expect(pageRouteToFolderPath("/")).toBe("");
      expect(pageRouteToUrl("/")).toBe("/");
    });
  });

  describe("parsePageRoute query parameter handling", () => {
    it("strips query string and retains clean folder path for dynamic route", () => {
      expect(parsePageRoute("/c/[id]?limit=10&offset=20")).toBe("/c/[id]");
      expect(parsePageRoute("c/[id]?limit=10&offset=20")).toBe("c/[id]");
      expect(parsePageRoute("/users?sort=asc")).toBe("/users");
    });
  });

  describe("parseRouteWithQueryParams", () => {
    it("parses static route without query parameters", () => {
      const res = parseRouteWithQueryParams("/dashboard/settings");
      expect(res.route).toBe("/dashboard/settings");
      expect(res.extractedPathParams).toEqual([]);
      expect(res.extractedQueryParams).toEqual([]);
    });

    it("extracts dynamic path params like [id]", () => {
      const res = parseRouteWithQueryParams("/c/[id]");
      expect(res.route).toBe("/c/[id]");
      expect(res.extractedPathParams).toHaveLength(1);
      expect(res.extractedPathParams[0]).toEqual({
        id: "param-id",
        name: "id",
        type: "string",
        required: true,
      });
      expect(res.extractedQueryParams).toEqual([]);
    });

    it("extracts multiple path params and query parameters from URL", () => {
      const res = parseRouteWithQueryParams("/c/[id]?limit=10&offset=20&active=true&filter=admin");
      expect(res.route).toBe("/c/[id]");
      expect(res.extractedPathParams).toHaveLength(1);
      expect(res.extractedPathParams[0]?.name).toBe("id");

      expect(res.extractedQueryParams).toHaveLength(4);
      expect(res.extractedQueryParams[0]).toEqual({
        id: "query-limit",
        name: "limit",
        type: "number",
        defaultValue: "10",
        required: false,
      });
      expect(res.extractedQueryParams[1]).toEqual({
        id: "query-offset",
        name: "offset",
        type: "number",
        defaultValue: "20",
        required: false,
      });
      expect(res.extractedQueryParams[2]).toEqual({
        id: "query-active",
        name: "active",
        type: "boolean",
        defaultValue: "true",
        required: false,
      });
      expect(res.extractedQueryParams[3]).toEqual({
        id: "query-filter",
        name: "filter",
        type: "string",
        defaultValue: "admin",
        required: false,
      });
    });

    it("handles catch-all dynamic routes like [...slug]", () => {
      const res = parseRouteWithQueryParams("/docs/[...slug]?tab=api");
      expect(res.route).toBe("/docs/[...slug]");
      expect(res.extractedPathParams[0]?.name).toBe("slug");
      expect(res.extractedQueryParams[0]?.name).toBe("tab");
    });
  });

  describe("computeCompiledPageRoute", () => {
    it("returns 'layout' when isLayout is true", () => {
      expect(computeCompiledPageRoute({ label: "/layout", isLayout: true })).toBe("layout");
      expect(computeCompiledPageRoute({ label: "layout", isLayout: true })).toBe("layout");
    });

    it("returns base route when query params are absent or empty", () => {
      expect(computeCompiledPageRoute({ label: "/c/[id]" })).toBe("/c/[id]");
      expect(computeCompiledPageRoute({ label: "c/[id]", queryParams: [] })).toBe("/c/[id]");
      expect(computeCompiledPageRoute({ label: "/" })).toBe("/");
      expect(computeCompiledPageRoute({ label: "" })).toBe("/");
    });

    it("formats query params with default values correctly", () => {
      expect(
        computeCompiledPageRoute({
          label: "/c/[id]",
          queryParams: [
            { name: "limit", defaultValue: "20" },
            { name: "offset", defaultValue: "0" },
          ],
        }),
      ).toBe("/c/[id]?limit=20&offset=0");
    });

    it("formats query params without default values with param name", () => {
      expect(
        computeCompiledPageRoute({
          label: "/search",
          queryParams: [
            { name: "q" },
            { name: "page", defaultValue: 1 },
          ],
        }),
      ).toBe("/search?q&page=1");
    });

    it("ensures path parameters are included in compiled route even if label is static", () => {
      expect(
        computeCompiledPageRoute({
          label: "c",
          pathParams: [{ name: "id" }],
          queryParams: [
            { name: "limit", defaultValue: "20" },
            { name: "offset", defaultValue: "0" },
          ],
        }),
      ).toBe("/c/[id]?limit=20&offset=0");
    });
  });

  describe("syncRouteWithUpdatedPathParams", () => {
    it("updates route URL when a path parameter is renamed", () => {
      const updated = syncRouteWithUpdatedPathParams({
        currentRoute: "/c/[id]",
        oldPathParams: [{ id: "p1", name: "id" }],
        newPathParams: [{ id: "p1", name: "userId" }],
      });
      expect(updated).toBe("/c/[userId]");
    });

    it("updates catch-all route segment when renamed", () => {
      const updated = syncRouteWithUpdatedPathParams({
        currentRoute: "/docs/[...slug]",
        oldPathParams: [{ id: "p1", name: "slug" }],
        newPathParams: [{ id: "p1", name: "path" }],
      });
      expect(updated).toBe("/docs/[...path]");
    });

    it("removes dynamic segment when a path parameter is deleted", () => {
      const updated = syncRouteWithUpdatedPathParams({
        currentRoute: "/c/[id]",
        oldPathParams: [{ id: "p1", name: "id" }],
        newPathParams: [],
      });
      expect(updated).toBe("/c");
    });

    it("appends new dynamic segment when a path parameter is added", () => {
      const updated = syncRouteWithUpdatedPathParams({
        currentRoute: "/c",
        oldPathParams: [],
        newPathParams: [{ id: "p2", name: "id" }],
      });
      expect(updated).toBe("/c/[id]");
    });

    it("adds missing path param from pathParams when route is static 'c' or '/c'", () => {
      expect(
        syncRouteWithUpdatedPathParams({
          currentRoute: "c",
          oldPathParams: [{ id: "p1", name: "id" }],
          newPathParams: [{ id: "p1", name: "id" }],
        }),
      ).toBe("/c/[id]");

      expect(
        syncRouteWithUpdatedPathParams({
          currentRoute: "/c",
          oldPathParams: [{ id: "p1", name: "id" }],
          newPathParams: [{ id: "p1", name: "id" }],
        }),
      ).toBe("/c/[id]");
    });

    it("does not modify layout routes", () => {
      const updated = syncRouteWithUpdatedPathParams({
        currentRoute: "layout",
        oldPathParams: [],
        newPathParams: [{ id: "p1", name: "id" }],
        isLayout: true,
      });
      expect(updated).toBe("layout");
    });
  });
});
