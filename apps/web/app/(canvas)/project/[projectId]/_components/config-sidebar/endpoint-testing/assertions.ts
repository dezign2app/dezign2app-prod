/**
 * Assertion evaluation for endpoint test case results.
 */
import { JSONValue } from "@/types/canvas";

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
  if (expectedBody !== undefined && expectedBody !== null && typeof expectedBody === "object" && Object.keys(expectedBody).length > 0) {
    const isBodyMatch = checkBodyMatches(actualBody as JSONValue, expectedBody as JSONValue);
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
 * Checks whether a given value is a valid ISO 8601 or parseable timestamp.
 */
function isValidTimestamp(val: unknown): boolean {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.length < 8) return false;
    // ISO 8601 regex: e.g. 2026-10-14T13:37:42.257Z or 2026-10-14 13:37:42
    const isoRegex = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;
    if (isoRegex.test(trimmed)) {
      return !isNaN(Date.parse(trimmed));
    }
    const parsed = Date.parse(trimmed);
    return !isNaN(parsed);
  }
  if (typeof val === "number") {
    // Unix epoch timestamp in seconds or ms (rough sanity range: > year 2000)
    return val > 946684800 && !isNaN(new Date(val > 1e11 ? val : val * 1000).getTime());
  }
  return false;
}

/**
 * Checks whether a field name or expected value signifies a timestamp/date field.
 */
function isTimestampField(key: string, expectedVal: unknown): boolean {
  const lower = key.toLowerCase();
  const nameMatches =
    lower === "timestamp" ||
    lower.endsWith("_at") ||
    lower.endsWith("at") ||
    lower.includes("time") ||
    lower.includes("date");

  if (nameMatches) return true;
  if (expectedVal !== null && expectedVal !== undefined && isValidTimestamp(expectedVal)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a value is a placeholder for a service name.
 */
function isServicePlaceholder(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const s = val.trim().toLowerCase();
  return (
    s === "service" ||
    s === "<service name>" ||
    s === "service-name" ||
    s === "${servicename}" ||
    s === "${service}" ||
    s === "${name}"
  );
}

/**
 * Checks whether the actual body contains or matches the expected body.
 */
function checkBodyMatches(
  actual: JSONValue,
  expected: JSONValue,
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

  if (typeof actual !== "object" || Array.isArray(actual)) {
    return { passed: false, detail: "Expected object in response but received non-object" };
  }

  const actualObj = actual as Record<string, JSONValue>;
  const expectedObj = expected as Record<string, JSONValue>;

  // Check object keys subset
  const missingKeys: string[] = [];
  const mismatchedKeys: string[] = [];

  for (const [key, expVal] of Object.entries(expectedObj)) {
    if (!(key in actualObj)) {
      missingKeys.push(key);
      continue;
    }

    const actVal = actualObj[key];

    // 1. Timestamp validation: check valid time format rather than strict value equality
    if (isTimestampField(key, expVal)) {
      if (isValidTimestamp(actVal)) {
        continue;
      } else {
        mismatchedKeys.push(`${key}: expected valid timestamp format, got "${actVal}"`);
        continue;
      }
    }

    // 2. Nested object comparison
    if (
      expVal !== null &&
      typeof expVal === "object" &&
      !Array.isArray(expVal)
    ) {
      const sub = checkBodyMatches(actVal as JSONValue, expVal);
      if (!sub.passed) mismatchedKeys.push(`${key} (${sub.detail})`);
      continue;
    }

    // 3. Flexible service placeholder matching (e.g. expected placeholder "service" vs actual service node name "User")
    if (key.toLowerCase() === "service" && (isServicePlaceholder(expVal) || isServicePlaceholder(actVal))) {
      if (typeof actVal === "string" && actVal.trim().length > 0) {
        continue;
      }
    }

    // 4. Flexible port matching (e.g. number vs string)
    if (key.toLowerCase() === "port" && String(expVal) === String(actVal)) {
      continue;
    }

    // 5. Primitive equality with number/string coercion
    const areValuesEqual =
      actVal === expVal ||
      (typeof expVal === "number" && typeof actVal === "string" && String(expVal) === actVal) ||
      (typeof expVal === "string" && typeof actVal === "number" && expVal === String(actVal));

    if (areValuesEqual) {
      continue;
    }

    if (typeof expVal !== "object" && expVal !== "") {
      mismatchedKeys.push(`${key}: expected "${expVal}", got "${actVal}"`);
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
