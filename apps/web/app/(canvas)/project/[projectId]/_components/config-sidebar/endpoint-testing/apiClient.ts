/**
 * Live HTTP API execution for endpoint test cases.
 */
import { JSONValue } from "@/types/canvas";
import { formatByteSize } from "./helpers";

export interface LiveApiCallResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: JSONValue;
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
