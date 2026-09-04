/**
 * URL construction helpers for endpoint testing.
 */

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
