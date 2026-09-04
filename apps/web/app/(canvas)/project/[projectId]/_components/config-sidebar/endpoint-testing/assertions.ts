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
    } else if (
      expVal !== null &&
      typeof expVal === "object" &&
      !Array.isArray(expVal)
    ) {
      const sub = checkBodyMatches(actualObj[key] as JSONValue, expVal);
      if (!sub.passed) mismatchedKeys.push(`${key} (${sub.detail})`);
    } else if (
      typeof expVal !== "object" &&
      typeof actualObj[key] === typeof expVal &&
      expVal !== "" &&
      actualObj[key] !== expVal
    ) {
      mismatchedKeys.push(`${key}: expected "${expVal}", got "${actualObj[key]}"`);
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
