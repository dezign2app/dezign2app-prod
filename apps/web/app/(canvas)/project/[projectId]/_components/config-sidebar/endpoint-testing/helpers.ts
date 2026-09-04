/**
 * Shared primitive helpers for endpoint testing utilities.
 */
import { BackendNode } from "@/types/canvas";

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
  if (tech === "nextjs" || node.type === "webPage") return "3000";
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
