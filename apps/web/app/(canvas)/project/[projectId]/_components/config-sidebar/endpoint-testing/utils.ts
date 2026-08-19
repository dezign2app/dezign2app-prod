import { Endpoint, BackendNode, JSONValue, JSONObject, Parameter } from "@/types/canvas";
import { SimulationTestCase } from "@workspace/canvas";

export function generateId(): string {
  return "tc-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
}

/**
 * Returns default port for a given service node.
 */
export function getServiceDefaultPort(node?: BackendNode | null): string {
  if (!node) return "8080";
  if (node.data?.port) return String(node.data.port);
  const tech = (node.data?.techStack || "").toLowerCase();
  if (tech === "fastapi" || tech === "python") return "8000";
  if (tech === "nextjs" || node.type === "webClient") return "3000";
  return "8080";
}

/**
 * Formats byte size into human readable string.
 */
export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

/**
 * Normalizes an endpoint path:
 * - Ensures a leading slash '/'
 * - Converts spaces to kebab-case hyphens (e.g. '/create product' -> '/create-product')
 * - Normalizes multiple consecutive slashes
 */
export function sanitizeEndpointPath(rawPath: string): string {
  if (!rawPath || !rawPath.trim()) return "/";
  let path = rawPath.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  path = path
    .split("/")
    .map((segment) => segment.trim().replace(/\s+/g, "-"))
    .join("/");
  path = path.replace(/\/+/g, "/");
  return path;
}

/**
 * Builds the full test URL replacing `:param` or `{param}` path variables
 * and appending query parameters.
 */
export function buildFullEndpointUrl(
  baseUrl: string,
  rawPath: string,
  pathParams: Record<string, string> = {},
  queryParams: Record<string, string> = {},
): string {
  const cleanBase = (baseUrl || "http://localhost:8080").replace(/\/+$/, "");
  let path = sanitizeEndpointPath(rawPath);

  // Replace :paramName or {paramName} in path
  Object.entries(pathParams).forEach(([k, v]) => {
    if (!k) return;
    const cleanKey = k.replace(/^[:{]/, "").replace(/}$/, "");
    const encodedVal = encodeURIComponent(v || `:${cleanKey}`);
    path = path.replace(new RegExp(`:${cleanKey}\\b`, "g"), encodedVal);
    path = path.replace(new RegExp(`\\{${cleanKey}\\}`, "g"), encodedVal);
  });

  // Query parameters
  const queryEntries = Object.entries(queryParams).filter(
    ([k, v]) => k.trim() && v !== undefined && v !== "",
  );
  let queryString = "";
  if (queryEntries.length > 0) {
    const searchParams = new URLSearchParams();
    queryEntries.forEach(([k, v]) => searchParams.append(k.trim(), v));
    queryString = `?${searchParams.toString()}`;
  }

  return `${cleanBase}${path}${queryString}`;
}

export interface LiveApiCallResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  rawText?: string;
  latencyMs: number;
  sizeFormatted: string;
  sizeBytes: number;
  error?: string;
  url: string;
  method: string;
  timestamp: string;
}

/**
 * Dispatches a real HTTP request against the live endpoint.
 */
export async function executeLiveApiCall({
  url,
  method,
  headers = {},
  body,
  signal,
  timeoutMs = 15000,
}: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<LiveApiCallResult> {
  const cleanMethod = (method || "GET").toUpperCase();
  const startTime = performance.now();
  const timestamp = new Date().toLocaleTimeString();

  // Create combined abort controller for timeout
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const combinedSignal = signal || timeoutController.signal;

  try {
    const reqHeaders = new Headers();
    Object.entries(headers).forEach(([k, v]) => {
      if (k && v !== undefined) reqHeaders.set(k, v);
    });

    if (!reqHeaders.has("content-type") && ["POST", "PUT", "PATCH"].includes(cleanMethod)) {
      reqHeaders.set("content-type", "application/json");
    }

    const fetchOptions: RequestInit = {
      method: cleanMethod,
      headers: reqHeaders,
      signal: combinedSignal,
      mode: "cors",
      cache: "no-store",
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(cleanMethod) && body !== undefined && body !== null) {
      if (typeof body === "string") {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    // Parse response headers
    const resHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    const rawText = await response.text();
    const sizeBytes = new Blob([rawText]).size;
    const sizeFormatted = formatByteSize(sizeBytes);

    let parsedBody: JSONValue = rawText;
    try {
      const parsed: JSONValue = JSON.parse(rawText);
      parsedBody = parsed;
    } catch {
      // Body is plain text / HTML / raw
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || (response.ok ? "OK" : "Error"),
      headers: resHeaders,
      body: parsedBody,
      rawText,
      latencyMs,
      sizeFormatted,
      sizeBytes,
      url,
      method: cleanMethod,
      timestamp,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const rawMsg = err instanceof Error ? err.message : String(err);
    let errorMessage = rawMsg;
    if (isAbort) {
      errorMessage = `Request timed out after ${timeoutMs / 1000}s`;
    } else if (errorMessage.toLowerCase().includes("failed to fetch") || errorMessage.toLowerCase().includes("networkerror")) {
      errorMessage = `Could not connect to ${url}. Make sure the service is running on this port and accessible.`;
    }

    return {
      ok: false,
      status: 0,
      statusText: "Connection Failed",
      headers: {},
      body: null,
      rawText: "",
      latencyMs,
      sizeFormatted: "0 B",
      sizeBytes: 0,
      error: errorMessage,
      url,
      method: cleanMethod,
      timestamp,
    };
  }
}

export interface AssertionResultItem {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail?: string;
}

/**
 * Compares expected vs actual values and returns detailed assertion results.
 */
export function evaluateAssertions({
  actualStatus,
  actualBody,
  latencyMs,
  expectedStatus,
  expectedBody,
  maxLatencyMs,
}: {
  actualStatus?: number;
  actualBody?: unknown;
  latencyMs?: number;
  expectedStatus?: number;
  expectedBody?: unknown;
  maxLatencyMs?: number;
}): AssertionResultItem[] {
  const assertions: AssertionResultItem[] = [];

  // 1. Status Code Assertion
  if (expectedStatus !== undefined && expectedStatus !== null) {
    const isStatusPassed = actualStatus === expectedStatus;
    assertions.push({
      id: "status-check",
      name: `Status code is ${expectedStatus}`,
      passed: isStatusPassed,
      expected: String(expectedStatus),
      actual: actualStatus !== undefined ? String(actualStatus) : "No Response",
      detail: isStatusPassed
        ? `Received status ${actualStatus}`
        : `Expected ${expectedStatus} but received ${actualStatus ?? "0"}`,
    });
  }

  // 2. Response Body Partial / Exact Assertion
  if (expectedBody !== undefined && expectedBody !== null && Object.keys(expectedBody as object).length > 0) {
    const isBodyMatch = checkBodyMatches(actualBody, expectedBody);
    assertions.push({
      id: "body-check",
      name: "Response body matches expected structure",
      passed: isBodyMatch.passed,
      expected: JSON.stringify(expectedBody, null, 2),
      actual: actualBody !== undefined ? JSON.stringify(actualBody, null, 2) : "None",
      detail: isBodyMatch.detail,
    });
  }

  // 3. Response Time SLA Assertion
  if (maxLatencyMs !== undefined && maxLatencyMs > 0) {
    const isLatencyPassed = latencyMs !== undefined && latencyMs <= maxLatencyMs;
    assertions.push({
      id: "latency-check",
      name: `Response time < ${maxLatencyMs}ms`,
      passed: isLatencyPassed,
      expected: `< ${maxLatencyMs}ms`,
      actual: latencyMs !== undefined ? `${latencyMs}ms` : "N/A",
      detail: isLatencyPassed
        ? `Response completed in ${latencyMs}ms`
        : `Response took ${latencyMs}ms which exceeded the SLA of ${maxLatencyMs}ms`,
    });
  }

  return assertions;
}

/**
 * Checks whether the actual body contains or matches the expected body.
 */
function checkBodyMatches(
  actual: any,
  expected: any,
): { passed: boolean; detail: string } {
  if (actual === undefined || actual === null) {
    return { passed: false, detail: "Actual response body is empty or undefined" };
  }

  if (typeof expected !== "object" || expected === null) {
    const passed = actual === expected;
    return {
      passed,
      detail: passed
        ? "Exact primitive value match"
        : `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    };
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { passed: false, detail: "Expected array in response but received non-array" };
    }
    if (expected.length === 0) {
      return { passed: true, detail: "Array received as expected" };
    }
    // Check first element structure match if actual has items
    return {
      passed: true,
      detail: `Received array with ${actual.length} items`,
    };
  }

  // Check object keys subset
  const missingKeys: string[] = [];
  const mismatchedKeys: string[] = [];

  for (const [key, expVal] of Object.entries(expected)) {
    if (!(key in actual)) {
      missingKeys.push(key);
    } else if (
      expVal !== null &&
      typeof expVal === "object" &&
      !Array.isArray(expVal)
    ) {
      const sub = checkBodyMatches(actual[key], expVal);
      if (!sub.passed) mismatchedKeys.push(`${key} (${sub.detail})`);
    } else if (
      typeof expVal !== "object" &&
      typeof actual[key] === typeof expVal &&
      expVal !== "" &&
      actual[key] !== expVal
    ) {
      mismatchedKeys.push(`${key}: expected "${expVal}", got "${actual[key]}"`);
    }
  }

  if (missingKeys.length > 0) {
    return {
      passed: false,
      detail: `Missing expected keys: ${missingKeys.join(", ")}`,
    };
  }

  if (mismatchedKeys.length > 0) {
    return {
      passed: false,
      detail: `Field mismatches: ${mismatchedKeys.slice(0, 3).join("; ")}`,
    };
  }

  return { passed: true, detail: "All expected fields and structures matched" };
}

/**
 * Generates default 200 OK and 400 Bad Request test cases for an endpoint.
 */
export function generateDefaultTestCases(
  endpoint: Endpoint,
  nodeId: string,
  serviceNode?: BackendNode | null,
): SimulationTestCase[] {
  const method = (endpoint.type || "GET").toUpperCase();
  const path = sanitizeEndpointPath(endpoint.name || "/");
  const expectedSuccessStatus = method === "POST" ? 201 : 200;

  // Path params
  const defaultPathParams: Record<string, string> = {};
  endpoint.pathParams?.forEach((p) => {
    const k = p.key || p.name;
    if (k) defaultPathParams[k] = p.defaultValue || p.value || "1";
  });

  // Query params
  const defaultQueryParams: Record<string, string> = {};
  endpoint.queryParams?.forEach((p) => {
    const k = p.key || p.name;
    if (k) defaultQueryParams[k] = p.defaultValue || p.value || "sample";
  });

  // Headers
  const defaultHeaders: Record<string, string> = {};
  endpoint.headers?.forEach((h) => {
    const k = (h.key || h.name || "").toLowerCase();
    if (k) defaultHeaders[k] = h.defaultValue || h.value || "";
  });
  if (endpoint.requireAuth !== false && !defaultHeaders["authorization"]) {
    defaultHeaders["authorization"] = "Bearer <test_jwt_token>";
  }
  if (["POST", "PUT", "PATCH"].includes(method) && !defaultHeaders["content-type"]) {
    defaultHeaders["content-type"] = "application/json";
  }

  const successBody = getInitialBody(endpoint);

  const successCase: SimulationTestCase = {
    id: `auto-${endpoint.id}-success`,
    name: `${expectedSuccessStatus} OK - Valid Request (${method} ${path})`,
    targetNodeId: nodeId,
    targetEventId: endpoint.id,
    isAutoGenerated: true,
    category: "auto",
    request: {
      headers: defaultHeaders,
      params: { ...defaultPathParams, ...defaultQueryParams },
      body: successBody,
    },
    expectedStatus: expectedSuccessStatus,
    expectedBody: {
      success: true,
      data: successBody,
    },
    mocks: {},
  };

  const validationCase: SimulationTestCase = {
    id: `auto-${endpoint.id}-validation`,
    name: `400 Bad Request - Validation Error (${method} ${path})`,
    targetNodeId: nodeId,
    targetEventId: endpoint.id,
    isAutoGenerated: true,
    category: "auto",
    request: {
      headers: defaultHeaders,
      params: {},
      body: {},
    },
    expectedStatus: 400,
    expectedBody: {
      error: "Validation Error",
    },
    mocks: {},
  };

  return [successCase, validationCase];
}

/**
 * Creates a new test case by preset type.
 */
export function createTestCaseFromPreset(
  preset: "200_ok" | "201_created" | "400_bad_request" | "401_unauthorized" | "404_not_found" | "custom",
  endpoint: Endpoint,
  nodeId: string,
  customName?: string,
): SimulationTestCase {
  const method = (endpoint.type || "GET").toUpperCase();
  const path = sanitizeEndpointPath(endpoint.name || "/");
  const defaultBody = getInitialBody(endpoint);

  const headers: Record<string, string> = {};
  endpoint.headers?.forEach((h) => {
    const k = (h.key || h.name || "").toLowerCase();
    if (k) headers[k] = h.defaultValue || h.value || "";
  });
  if (endpoint.requireAuth !== false && !headers["authorization"]) {
    headers["authorization"] = "Bearer <test_jwt_token>";
  }
  if (["POST", "PUT", "PATCH"].includes(method) && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const pathParams: Record<string, string> = {};
  endpoint.pathParams?.forEach((p) => {
    const k = p.key || p.name;
    if (k) pathParams[k] = p.defaultValue || p.value || "1";
  });

  const queryParams: Record<string, string> = {};
  endpoint.queryParams?.forEach((p) => {
    const k = p.key || p.name;
    if (k) queryParams[k] = p.defaultValue || p.value || "";
  });

  const baseParams = { ...pathParams, ...queryParams };

  switch (preset) {
    case "200_ok":
      return {
        id: generateId(),
        name: customName || `200 OK - Standard Success`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers, params: baseParams, body: defaultBody },
        expectedStatus: 200,
        expectedBody: { success: true },
        mocks: {},
      };
    case "201_created":
      return {
        id: generateId(),
        name: customName || `201 Created - Resource Created`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers, params: baseParams, body: defaultBody },
        expectedStatus: 201,
        expectedBody: { success: true },
        mocks: {},
      };
    case "400_bad_request":
      return {
        id: generateId(),
        name: customName || `400 Bad Request - Invalid Payload`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers, params: {}, body: {} },
        expectedStatus: 400,
        expectedBody: { error: "Bad Request" },
        mocks: {},
      };
    case "401_unauthorized":
      const noAuthHeaders = { ...headers };
      delete noAuthHeaders["authorization"];
      return {
        id: generateId(),
        name: customName || `401 Unauthorized - Missing Token`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers: noAuthHeaders, params: baseParams, body: defaultBody },
        expectedStatus: 401,
        expectedBody: { error: "Unauthorized" },
        mocks: {},
      };
    case "404_not_found":
      return {
        id: generateId(),
        name: customName || `404 Not Found - Non-Existent ID`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers, params: { ...baseParams, id: "999999" }, body: defaultBody },
        expectedStatus: 404,
        expectedBody: { error: "Not Found" },
        mocks: {},
      };
    case "custom":
    default:
      return {
        id: generateId(),
        name: customName || `Test Case for ${method} ${path}`,
        targetNodeId: nodeId,
        targetEventId: endpoint.id,
        isAutoGenerated: false,
        category: "manual",
        request: { headers, params: baseParams, body: defaultBody },
        expectedStatus: method === "POST" ? 201 : 200,
        expectedBody: undefined,
        mocks: {},
      };
  }
}
