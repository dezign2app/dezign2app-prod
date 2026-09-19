import { describe, it, expect } from "vitest";
import { normalizePageRoute, arePageRoutesEqual, parsePageRoute, pageRouteToFolderPath, pageRouteToUrl } from "../utils";

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
});
