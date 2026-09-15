// ═══════════════════════════════════════════════════════════════
// MODULE: RedisBindingSorter
// LAYER:  generators / routeGenerator / pipeline / renderers
// EMITS:  Argument sorting utilities for Redis pipeline step bindings
// ═══════════════════════════════════════════════════════════════

import { PipelineStepInputBinding } from "@workspace/canvas/types";

export function extractSigParamNames(signature?: string): string[] {
  if (!signature) return [];
  const match = signature.match(/\((.*?)\)/);
  const paramList = match?.[1];
  if (!paramList || !paramList.trim()) return [];
  return paramList
    .split(",")
    .map((p) => (p.trim().split(/[:=]/)[0] ?? "").replace(/^\.\.\./, "").trim())
    .filter(Boolean);
}

export function getRedisArgRank(argName: string): number {
  const name = argName.toLowerCase();
  if (name === "key" || name === "id" || name.endsWith("id") || name.endsWith("key")) return 10;
  if (name === "field") return 20;
  if (name === "longitude" || name === "lat" || name === "long") return 25;
  if (name === "latitude") return 26;
  if (name === "score") return 27;
  if (["item", "value", "data", "payload", "body", "fields", "items", "member"].includes(name)) return 30;
  if (["start", "stop", "index"].includes(name)) return 40;
  if (["lastid"].includes(name)) return 50;
  if (["count", "limit", "radius"].includes(name)) return 60;
  if (["ttl", "ttlseconds", "seconds"].includes(name)) return 70;
  if (["unit"].includes(name)) return 80;
  return 100;
}

export function sortRedisBindings(
  bindings: PipelineStepInputBinding[],
  signature?: string,
): PipelineStepInputBinding[] {
  const sigParams = extractSigParamNames(signature);

  return [...bindings].sort((a, b) => {
    if (sigParams.length > 0) {
      const idxA = sigParams.findIndex((p) => {
        const pLower = p.toLowerCase();
        const aLower = a.argName.toLowerCase();
        if (pLower === aLower) return true;
        if (
          (pLower === "id" || pLower === "key") &&
          (aLower === "key" || aLower === "id" || aLower.endsWith("id") || aLower.endsWith("key"))
        ) return true;
        if (
          ["item", "value", "data"].includes(pLower) &&
          ["item", "value", "data", "payload", "body"].includes(aLower)
        ) return true;
        return false;
      });
      const idxB = sigParams.findIndex((p) => {
        const pLower = p.toLowerCase();
        const bLower = b.argName.toLowerCase();
        if (pLower === bLower) return true;
        if (
          (pLower === "id" || pLower === "key") &&
          (bLower === "key" || bLower === "id" || bLower.endsWith("id") || bLower.endsWith("key"))
        ) return true;
        if (
          ["item", "value", "data"].includes(pLower) &&
          ["item", "value", "data", "payload", "body"].includes(bLower)
        ) return true;
        return false;
      });
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    return getRedisArgRank(a.argName) - getRedisArgRank(b.argName);
  });
}
