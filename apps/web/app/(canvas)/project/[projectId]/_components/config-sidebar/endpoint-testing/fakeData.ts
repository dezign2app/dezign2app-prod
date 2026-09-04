/**
 * Fake data generation and initial request body seeding for endpoint test cases.
 */
import { Endpoint, JSONValue, JSONObject } from "@/types/canvas";

/**
 * Generates realistic fake data based on field name, type, and defaults.
 */
export function generateFakeDataForField(
  fieldName: string,
  rawType: string = "string",
  defaultValue?: string,
  required?: boolean,
): JSONValue {
  if (defaultValue !== undefined && defaultValue !== "") {
    try {
      const parsed: JSONValue = JSON.parse(defaultValue);
      return parsed;
    } catch {
      return defaultValue;
    }
  }

  const name = (fieldName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const type = (rawType || "string").toLowerCase().trim();

  // 1. Specific Semantic Field Names Match
  if (name.includes("email")) {
    return "alice@example.com";
  }
  if (name.includes("password") || name.includes("passcode") || name.includes("secret")) {
    return "SecurePass123!";
  }
  if (name.includes("phone") || name.includes("mobile") || name.includes("tel")) {
    return "+1-555-0199";
  }
  if (name === "username" || name === "handle") {
    return "johndoe";
  }
  if (name.includes("firstname")) {
    return "John";
  }
  if (name.includes("lastname")) {
    return "Doe";
  }
  if (name === "name" || name.includes("fullname") || name.includes("author") || name.includes("creator")) {
    return "John Doe";
  }
  if (name.includes("title") || name.includes("subject") || name.includes("header")) {
    return "Sample Product Title";
  }
  if (
    name.includes("description") ||
    name.includes("desc") ||
    name.includes("bio") ||
    name.includes("summary") ||
    name.includes("details") ||
    name.includes("notes") ||
    name.includes("comment") ||
    name.includes("message") ||
    name.includes("content")
  ) {
    return "A detailed sample description for testing the API.";
  }
  if (
    name.includes("price") ||
    name.includes("amount") ||
    name.includes("cost") ||
    name.includes("total") ||
    name.includes("balance") ||
    name.includes("salary") ||
    name.includes("rate") ||
    name.includes("fee")
  ) {
    return 49.99;
  }
  if (
    name.includes("quantity") ||
    name.includes("qty") ||
    name.includes("count") ||
    name.includes("stock") ||
    name.includes("age") ||
    name.includes("limit") ||
    name.includes("size")
  ) {
    return 10;
  }
  if (name.includes("avatar") || name.includes("image") || name.includes("photo") || name.includes("picture") || name.includes("logo")) {
    return "https://images.unsplash.com/photo-1534528741775-53994a69daeb";
  }
  if (name.includes("url") || name.includes("link") || name.includes("website")) {
    return "https://example.com";
  }
  if (name.includes("uuid") || name.includes("guid")) {
    return "550e8400-e29b-41d4-a716-446655440000";
  }
  if (name.endsWith("id") || name.startsWith("id")) {
    return "rec_test_101";
  }
  if (name.includes("role")) {
    return "admin";
  }
  if (name.includes("status") || name.includes("state")) {
    return "active";
  }
  if (name.includes("address") || name.includes("street")) {
    return "123 Market Street, Suite 400";
  }
  if (name.includes("city")) {
    return "San Francisco";
  }
  if (name.includes("country")) {
    return "United States";
  }
  if (name.includes("zip") || name.includes("postal")) {
    return "94105";
  }
  if (name.includes("tags") || name.includes("categories") || name.includes("genres") || name.includes("topics")) {
    return ["electronics", "featured"];
  }
  if (name.includes("category") || name.includes("tag") || name.includes("genre") || name.includes("topic")) {
    return "electronics";
  }
  if (
    name.includes("date") ||
    name.includes("createdat") ||
    name.includes("updatedat") ||
    name.includes("timestamp") ||
    name.includes("expiresat") ||
    name.includes("time")
  ) {
    return new Date().toISOString();
  }
  if (
    name.startsWith("is") ||
    name.startsWith("has") ||
    name.includes("enabled") ||
    name.includes("active") ||
    name.includes("verified") ||
    name.includes("published") ||
    name.includes("completed") ||
    name.includes("instock")
  ) {
    return true;
  }

  // 2. Type-based defaults
  if (type === "number" || type === "int" || type === "integer") {
    return 42;
  }
  if (type === "float" || type === "double" || type === "decimal") {
    return 19.99;
  }
  if (type === "boolean" || type === "bool") {
    return true;
  }
  if (type === "array" || type === "list") {
    return ["sample_item_1", "sample_item_2"];
  }
  if (type === "object" || type === "json") {
    return { sampleKey: "sample_value" };
  }
  if (type === "date" || type === "datetime") {
    return new Date().toISOString();
  }

  // 3. Clean string fallback
  const humanReadable = fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim();
  return humanReadable ? `Sample ${humanReadable}` : "sample_value";
}

/**
 * Safely extracts an initial JSON sample body populated with fake data from endpoint definition.
 */
export function getInitialBody(endpoint?: Endpoint | null): JSONValue {
  if (!endpoint) return {};

  // 1. If explicit fields configured in requestBody.fields
  if (endpoint.requestBody?.fields && endpoint.requestBody.fields.length > 0) {
    const obj: JSONObject = {};
    endpoint.requestBody.fields.forEach((f) => {
      const fieldKey = f.key || f.name;
      if (!fieldKey) return;
      obj[fieldKey] = generateFakeDataForField(
        fieldKey,
        f.type || "string",
        f.defaultValue,
        f.required,
      );
    });
    return obj;
  }

  // 2. If rawJson is configured
  if (endpoint.requestBody?.rawJson && endpoint.requestBody.rawJson.trim()) {
    try {
      const parsed: JSONValue = JSON.parse(endpoint.requestBody.rawJson);
      return parsed;
    } catch {}
  }

  // 3. If endpoint.body is configured
  if (endpoint.body && endpoint.body.trim()) {
    try {
      const parsed: JSONValue = JSON.parse(endpoint.body);
      return parsed;
    } catch {}
  }

  // 4. If endpoint has params
  if (endpoint.params && endpoint.params.length > 0) {
    const obj: JSONObject = {};
    endpoint.params.forEach((p) => {
      const key = p.name || p.key;
      if (key && !key.startsWith(":")) {
        obj[key] = generateFakeDataForField(
          key,
          p.type || "string",
          p.defaultValue || p.value,
          p.required,
        );
      }
    });
    if (Object.keys(obj).length > 0) return obj;
  }

  // 5. Default fallback based on HTTP method
  const method = (endpoint.type || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const rawName = (endpoint.name || "item").replace(/^\//, "").replace(/[^a-zA-Z0-9]/g, " ").trim();
    return {
      title: rawName ? `Sample ${rawName}` : "Sample Item",
      description: "Test request payload for endpoint simulation.",
      status: "active",
    };
  }

  return {};
}
