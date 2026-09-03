import { describe, it, expect } from "vitest";
import {
  extractNestedPaths,
  parseRawJsonSafe,
  formatJsonPretty,
  isOutputSchemaMissing,
} from "../nestedJsonSchema";

describe("nestedJsonSchema", () => {
  describe("extractNestedPaths", () => {
    it("extracts paths from flat objects", () => {
      const obj = { id: "123", name: "Alice", active: true, count: 5 };
      const paths = extractNestedPaths(obj);
      const pathNames = paths.map((p) => p.path);

      expect(pathNames).toContain("id");
      expect(pathNames).toContain("name");
      expect(pathNames).toContain("active");
      expect(pathNames).toContain("count");
    });

    it("extracts paths from deeply nested objects", () => {
      const obj = {
        user: {
          profile: {
            avatar: "https://example.com/avatar.png",
            settings: {
              theme: "dark",
              notifications: {
                email: true,
              },
            },
          },
        },
      };

      const paths = extractNestedPaths(obj);
      const pathMap = new Map(paths.map((p) => [p.path, p.type]));

      expect(pathMap.has("user.profile.avatar")).toBe(true);
      expect(pathMap.get("user.profile.avatar")).toBe("string");
      expect(pathMap.has("user.profile.settings.theme")).toBe(true);
      expect(pathMap.get("user.profile.settings.notifications.email")).toBe("boolean");
    });

    it("extracts paths from arrays of objects", () => {
      const obj = {
        items: [
          {
            id: "item_1",
            price: 99.99,
            tags: ["sale", "featured"],
            detail: {
              sku: "SKU123",
            },
          },
        ],
      };

      const paths = extractNestedPaths(obj);
      const pathNames = paths.map((p) => p.path);

      expect(pathNames).toContain("items[]");
      expect(pathNames).toContain("items[].id");
      expect(pathNames).toContain("items[].price");
      expect(pathNames).toContain("items[].detail.sku");
    });

    it("extracts paths from a realistic Stripe-like charge response", () => {
      const stripeResponse = {
        id: "ch_3MtwBwLkdIwHu7ix0snN00x5",
        object: "charge",
        amount: 2000,
        currency: "usd",
        paid: true,
        billing_details: {
          address: {
            city: "San Francisco",
            country: "US",
            line1: "510 Townsend St",
            postal_code: "94103",
          },
          email: "customer@example.com",
          name: "Jane Doe",
        },
        payment_method_details: {
          type: "card",
          card: {
            brand: "visa",
            last4: "4242",
          },
        },
      };

      const paths = extractNestedPaths(stripeResponse);
      const pathNames = paths.map((p) => p.path);

      expect(pathNames).toContain("id");
      expect(pathNames).toContain("billing_details.address.city");
      expect(pathNames).toContain("billing_details.address.postal_code");
      expect(pathNames).toContain("billing_details.email");
      expect(pathNames).toContain("payment_method_details.card.brand");
      expect(pathNames).toContain("payment_method_details.card.last4");
    });
  });

  describe("parseRawJsonSafe & formatJsonPretty", () => {
    it("handles valid and invalid JSON safely", () => {
      const valid = parseRawJsonSafe('{"foo": "bar"}');
      expect(valid.error).toBeNull();
      expect(valid.parsed).toEqual({ foo: "bar" });

      const invalid = parseRawJsonSafe('{"foo": broken}');
      expect(invalid.error).not.toBeNull();
      expect(invalid.parsed).toBeNull();

      const empty = parseRawJsonSafe("");
      expect(empty.error).toBeNull();
      expect(empty.parsed).toBeNull();
    });

    it("formats JSON with 2-space indentation", () => {
      const compact = '{"a":1,"b":[2,3]}';
      const formatted = formatJsonPretty(compact);
      expect(formatted).toBe(JSON.stringify(JSON.parse(compact), null, 2));
    });
  });

  describe("isOutputSchemaMissing", () => {
    it("returns true when schema is empty or missing", () => {
      expect(isOutputSchemaMissing(undefined)).toBe(true);
      expect(isOutputSchemaMissing({})).toBe(true);
      expect(isOutputSchemaMissing({ responseBody: { fields: [] } })).toBe(true);
      expect(isOutputSchemaMissing({ responseBody: { rawJson: "" } })).toBe(true);
      expect(isOutputSchemaMissing({ responseBody: { rawJson: "   " } })).toBe(true);
    });

    it("returns false when valid fields or non-empty rawJson is provided", () => {
      expect(
        isOutputSchemaMissing({
          responseBody: { fields: [{ name: "id" }] },
        }),
      ).toBe(false);

      expect(
        isOutputSchemaMissing({
          responseBody: { rawJson: '{"id": "abc"}' },
        }),
      ).toBe(false);
    });
  });
});
