import { toVarName } from "../../../../utils";

/**
 * Converts Express/URL path params (:id) to FastAPI/Python format ({id})
 */
export function convertPathParams(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
}

/**
 * Generates a clean camelCase route file name
 */
export function toPythonRouteFileName(
  method: string,
  pathOrName: string,
  index: number,
): string {
  const methodStr = (method || "get").toLowerCase();
  const rawName = `${methodStr}_${pathOrName || ""}`;
  return toVarName(rawName) || `${methodStr}Route${index + 1}`;
}
