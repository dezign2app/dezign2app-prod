import { ExternalQueryParam } from "@workspace/canvas/types";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export function isHttpMethod(val: string): val is HttpMethod {
  return val === "GET" || val === "POST" || val === "PUT" || val === "PATCH" || val === "DELETE";
}

/**
 * Replaces `{{variableName}}` tokens with their corresponding values from the provided map.
 */
export function interpolateString(template: string, values: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return values[key] !== undefined ? values[key] : `{{${key}}}`;
  });
}

/**
 * Builds the fully resolved preview target URL including query parameters.
 */
export function resolveFullUrl(
  baseUrl: string,
  queryParams: ExternalQueryParam[],
  testValues: Record<string, string>,
): string {
  let u = interpolateString(baseUrl, testValues);
  const activeParams = queryParams.filter(
    (q) => q.enabled !== false && Boolean((q.key || q.name)?.trim()),
  );

  if (activeParams.length > 0 && u) {
    const urlObj = u.includes("://") ? new URL(u) : null;
    if (urlObj) {
      activeParams.forEach((qp) => {
        const k = qp.key || qp.name || "";
        urlObj.searchParams.set(k, interpolateString(qp.value || "", testValues));
      });
      u = urlObj.toString();
    } else {
      const qs = activeParams
        .map((qp) => {
          const k = qp.key || qp.name || "";
          return `${encodeURIComponent(k)}=${encodeURIComponent(interpolateString(qp.value || "", testValues))}`;
        })
        .join("&");
      u = u.includes("?") ? `${u}&${qs}` : `${u}?${qs}`;
    }
  }

  return u;
}
